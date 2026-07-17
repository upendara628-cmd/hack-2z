import time
import requests
import urllib3
import httpx
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq

# Disable SSL verification warnings to avoid polluting output logs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
# Enable CORS so our React app on localhost:3000 can communicate with port 5000
CORS(app, resources={r"/api/*": {"origins": "*"}})

import os

# Load environment variables from .env file if it exists
for env_path in ['.env', '../.env', 'backend/.env', '../backend/.env']:
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    parts = line.strip().split('=', 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip()

CURRENTS_API_KEY = os.environ.get("CURRENTS_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")

# Initialize Groq Client with custom http client to disable SSL certificate verification locally
try:
    http_client = httpx.Client(verify=False)
    client = Groq(api_key=GROQ_API_KEY, http_client=http_client)
except Exception as e:
    print(f"Error initializing Groq client: {e}")
    client = None

# Simple in-memory cache to prevent hitting API limits and ensure instantaneous UI updates
# Format: { keyword: { "timestamp": float, "data": [...] } }
CACHE_EXPIRY_SECONDS = 600  # 10 minutes cache
news_cache = {}

def analyze_article_bias(title, description):
    """
    Analyzes political bias, tone, and omitted facts using Groq's Llama 3.1 model.
    Returns a dictionary with 'tone' and 'analysis' (list of bullet points).
    """
    if not client:
        return {"tone": "Neutral", "analysis": ["AI Analysis unavailable: Groq client not initialized."]}

    # Ensure description is present
    text_to_analyze = description if description else title
    if not text_to_analyze:
        return {"tone": "Neutral", "analysis": ["No text available for analysis."]}

    prompt = f"""
    Analyze the following news article excerpt for political bias, tone, and omission of facts.
    
    Article Title: {title}
    Article Text: {text_to_analyze}
    
    You must respond strictly in JSON format. The JSON object must have exactly two fields:
    1. "tone": Must be exactly one of the strings: "Left-Leaning", "Right-Leaning", or "Neutral".
    2. "analysis": An array of exactly 3 brief bullet points analyzing the bias, omitted facts, or framing.
    
    JSON format example:
    {{
      "tone": "Neutral",
      "analysis": [
        "The excerpt relies on official government reports and maintains a balanced stance.",
        "Omits alternative economic interpretations from independent experts.",
        "Framing uses objective language without emotionally charged terms."
      ]
    }}
    """
    
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an impartial AI news analyst who analyzes political bias and omissions. You output strictly valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        # Parse the JSON response
        import json
        result = json.loads(chat_completion.choices[0].message.content)
        
        # Validation of fields
        tone = result.get("tone", "Neutral")
        if tone not in ["Left-Leaning", "Right-Leaning", "Neutral"]:
            tone = "Neutral"
            
        analysis = result.get("analysis", [])
        if not isinstance(analysis, list) or len(analysis) == 0:
            analysis = ["Analysis output was malformed or incomplete."]
            
        # Ensure it has exactly 3 bullets if possible
        analysis = analysis[:3]
        while len(analysis) < 3:
            analysis.append("Neutral or balanced coverage overall.")
            
        return {
            "tone": tone,
            "analysis": analysis
        }
    except Exception as e:
        print(f"Error in Groq API analysis: {e}")
        return {
            "tone": "Neutral",
            "analysis": [
                f"Could not perform bias analysis due to an error.",
                "Verify API connection and rate limits.",
                "Ensure article description contains sufficient text."
            ]
        }

@app.route('/api/news', methods=['GET'])
def get_news():
    keyword = request.args.get('keyword', '').strip().lower()
    country = request.args.get('country', '').strip().lower()

    # Determine cache key
    if country:
        cache_key = f"country:{country}"
    elif keyword:
        cache_key = f"keyword:{keyword}"
    else:
        cache_key = "keyword:world"
        keyword = "world"

    # 1. Check cache first
    now = time.time()
    if cache_key in news_cache:
        cached_item = news_cache[cache_key]
        if now - cached_item['timestamp'] < CACHE_EXPIRY_SECONDS:
            print(f"Serving cached news for key: {cache_key}")
            return jsonify(cached_item['data'])

    raw_articles = []

    # 2. Fetch from Currents API
    news_url = "https://api.currentsapi.services/v1/search"
    if country:
        params = {
            "country": country,
            "language": "en",
            "page_size": 4
        }
    else:
        params = {
            "keywords": keyword,
            "language": "en",
            "page_size": 4
        }
    
    headers = {"Authorization": f"Bearer {CURRENTS_API_KEY}"}
    print(f"Fetching Currents API news for {cache_key}...")
    try:
        response = requests.get(news_url, headers=headers, params=params, verify=False, timeout=10)
        news_data = response.json()
        articles_curr = news_data.get("news", [])
        for art in articles_curr:
            raw_articles.append({
                "source": "CurrentsAPI",
                "id": art.get("id", ""),
                "title": art.get("title", ""),
                "description": art.get("description", ""),
                "url": art.get("url", "#"),
                "image": art.get("image", None),
                "author": art.get("author", "Staff Reporter") or "Staff Reporter",
                "time": art.get("published", "")[:16].replace("T", " ") if art.get("published") else "Recent"
            })
    except Exception as e:
        print(f"Error fetching from Currents API: {e}")

    # 3. Fetch from NewsAPI (if configured)
    has_newsapi = NEWSAPI_KEY and "PLACEHOLDER" not in NEWSAPI_KEY
    if has_newsapi:
        print(f"Fetching NewsAPI news for {cache_key}...")
        try:
            if country:
                newsapi_url = "https://newsapi.org/v2/top-headlines"
                params_n = {
                    "country": country,
                    "apiKey": NEWSAPI_KEY,
                    "pageSize": 4
                }
            else:
                newsapi_url = "https://newsapi.org/v2/everything"
                params_n = {
                    "q": keyword,
                    "language": "en",
                    "apiKey": NEWSAPI_KEY,
                    "pageSize": 4
                }
            
            response = requests.get(newsapi_url, params=params_n, verify=False, timeout=10)
            newsapi_data = response.json()
            articles_n = newsapi_data.get("articles", [])
            for art in articles_n:
                raw_articles.append({
                    "source": "NewsAPI",
                    "id": art.get("url", ""),
                    "title": art.get("title", ""),
                    "description": art.get("description", ""),
                    "url": art.get("url", "#"),
                    "image": art.get("urlToImage", None),
                    "author": art.get("author", "Staff Reporter") or "Staff Reporter",
                    "time": art.get("publishedAt", "")[:16].replace("T", " ") if art.get("publishedAt") else "Recent"
                })
        except Exception as e:
            print(f"Error fetching from NewsAPI: {e}")

    # 4. Deduplicate and Merge
    seen_titles = set()
    merged_articles = []
    for art in raw_articles:
        title_norm = art["title"].strip().lower() if art["title"] else ""
        if not title_norm or title_norm in seen_titles:
            continue
        seen_titles.add(title_norm)
        merged_articles.append(art)

    # Fallback if empty
    if not merged_articles:
        print("Both APIs returned no articles or failed. Serving fallback mock articles.")
        fallback_data = get_fallback_articles(keyword if keyword else country)
        return jsonify(fallback_data)

    # Cap to 5 to run Groq efficiently
    merged_articles = merged_articles[:5]

    # 5. Run Groq AI Bias Analysis
    processed_articles = []
    for article in merged_articles:
        title = article["title"]
        description = article["description"]
        
        safe_title = title[:50].encode('ascii', errors='ignore').decode('ascii')
        print(f"Analyzing article: {safe_title}...")
        bias_report = analyze_article_bias(title, description)
        
        processed_articles.append({
            "id": article["id"],
            "title": title,
            "description": description,
            "url": article["url"],
            "image": article["image"] or "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop",
            "author": article["author"],
            "time": article["time"],
            "category": (keyword if keyword else "LOCAL").upper(),
            "source": article["source"],
            "bias_tone": bias_report["tone"],
            "bias_analysis": bias_report["analysis"]
        })

    # Cache the result
    news_cache[cache_key] = {
        "timestamp": now,
        "data": processed_articles
    }

    return jsonify(processed_articles)

def get_fallback_articles(keyword):
    """
    Returns realistic mock articles based on the requested keyword
    with pre-populated mock bias analysis in case API limits are hit.
    """
    if "politics" in keyword:
        return [
            {
                "id": "mock-p1",
                "title": "Global Coalition Pledges New Environmental Commitments at Summit",
                "description": "Leaders from over 50 countries have reached an agreement on reducing carbon emissions by 40% over the next decade.",
                "url": "https://example.com/summit",
                "image": "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=250&fit=crop",
                "author": "Marcus Thorne",
                "time": "1 hour ago",
                "category": "POLITICS",
                "bias_tone": "Neutral",
                "bias_analysis": [
                    "Provides balanced coverage quoting representatives from both developing and developed nations.",
                    "Relies primarily on official summit press releases, which framing is highly diplomatic.",
                    "Accurately captures the policy details without editorializing the text."
                ]
            },
            {
                "id": "mock-p2",
                "title": "Tax Reform Bill Sparks Heated Debate in Senate Committee",
                "description": "A controversial proposal to restructure corporate tax rates saw fierce arguments from senators on both sides of the aisle.",
                "url": "https://example.com/tax-reform",
                "image": "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&h=250&fit=crop",
                "author": "Elena Rostova",
                "time": "3 hours ago",
                "category": "POLITICS",
                "bias_tone": "Left-Leaning",
                "bias_analysis": [
                    "Gives more quotes and space to senators opposing corporate tax cuts.",
                    "Frames tax reductions as 'failing to reach working families' using critical vocabulary.",
                    "Omits arguments from independent economists defending the tax code's potential long-term GDP growth."
                ]
            }
        ]
    elif "tech" in keyword:
        return [
            {
                "id": "mock-t1",
                "title": "Nvidia Announces Next-Generation AI Supercomputer Chip Architecture",
                "description": "The semiconductor giant unveiled its new hardware platform, promising a 10x increase in speed for training large language models.",
                "url": "https://example.com/nvidia",
                "image": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop",
                "author": "Sarah Chen",
                "time": "2 hours ago",
                "category": "TECHNOLOGY",
                "bias_tone": "Neutral",
                "bias_analysis": [
                    "Focuses purely on the technical performance figures published in the datasheet.",
                    "Features standard excitement about computing power without corporate favoritism.",
                    "Highlights electricity consumption figures accurately."
                ]
            },
            {
                "id": "mock-t2",
                "title": "Social Media Platform Faces New Antitrust Investigation Over Monopolistic Ads API",
                "description": "Regulators have launched an in-depth probe into the company's advertising system, alleging unfair competition.",
                "url": "https://example.com/antitrust",
                "image": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=250&fit=crop",
                "author": "David Vance",
                "time": "5 hours ago",
                "category": "TECHNOLOGY",
                "bias_tone": "Right-Leaning",
                "bias_analysis": [
                    "Highlights the burden of government regulation on private innovation.",
                    "Minimizes user privacy concerns highlighted by antitrust regulators.",
                    "Omits testimony from smaller tech startups that claim to be squeezed out by the monopoly."
                ]
            }
        ]
    else:  # Default/World news
        return [
            {
                "id": "mock-w1",
                "title": "Germany Completes Transition to Green Energy Infrastructure",
                "description": "With the decommissioning of its last traditional power plant, the nation hits a major environmental milestone.",
                "url": "https://example.com/germany",
                "image": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=500&fit=crop",
                "author": "Dieter Schmidt",
                "time": "1 hour ago",
                "category": "WORLD",
                "bias_tone": "Neutral",
                "bias_analysis": [
                    "Highlights the successful construction of renewable projects over the last decade.",
                    "Provides comments from both utility companies and climate activist groups.",
                    "Identifies remaining grid storage challenges objectively."
                ]
            }
        ]

if __name__ == '__main__':
    # Running Flask app on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
