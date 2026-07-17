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

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Simple in-memory cache to prevent hitting API limits and ensure instantaneous UI updates
# Format: { keyword: { "timestamp": float, "data": [...] } }
CACHE_EXPIRY_SECONDS = 600  # 10 minutes cache
news_cache = {}

def get_supabase_cache(cache_key):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    from datetime import datetime, timedelta, timezone
    expiry_time = (datetime.now(timezone.utc) - timedelta(seconds=CACHE_EXPIRY_SECONDS)).isoformat()
    
    url = f"{SUPABASE_URL}/rest/v1/news_cache?cache_key=eq.{cache_key}&created_at=gt.{expiry_time}&select=*"
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"Serving cached news from Supabase for: {cache_key}")
                return data
        return None
    except Exception as e:
        print(f"Error querying Supabase cache: {e}")
        return None

def save_supabase_cache(cache_key, articles):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    payload = []
    for art in articles:
        payload.append({
            "id": art["id"],
            "title": art["title"],
            "description": art["description"],
            "url": art["url"],
            "image": art["image"],
            "author": art["author"],
            "time": art["time"],
            "category": art["category"],
            "source": art["source"],
            "bias_tone": art["bias_tone"],
            "bias_analysis": art["bias_analysis"],
            "cache_key": cache_key
        })
        
    try:
        response = requests.post(f"{SUPABASE_URL}/rest/v1/news_cache", headers=headers, json=payload, verify=False, timeout=5)
        if response.status_code not in [200, 201]:
            print(f"Supabase cache save warning (status {response.status_code}): {response.text}")
    except Exception as e:
        print(f"Error writing to Supabase cache: {e}")

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

    # 1. Check Supabase cache first
    db_cached = get_supabase_cache(cache_key)
    if db_cached:
        return jsonify(db_cached)

    # Fallback to local memory cache
    now = time.time()
    if cache_key in news_cache:
        cached_item = news_cache[cache_key]
        if now - cached_item['timestamp'] < CACHE_EXPIRY_SECONDS:
            print(f"Serving cached news from local memory for key: {cache_key}")
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
    save_supabase_cache(cache_key, processed_articles)

    return jsonify(processed_articles)

@app.route('/api/location-stats', methods=['POST'])
def save_location_stats():
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400
        
    location_name = data.get("location_name", "Unknown")
    country_code = data.get("country_code", "unknown")
    coords = data.get("coords", {})
    bias_stats = data.get("bias_stats", {})
    
    # Save to Supabase if configured
    if SUPABASE_URL and SUPABASE_KEY:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "location_name": location_name,
            "country_code": country_code,
            "latitude": coords.get("lat") if coords else None,
            "longitude": coords.get("lon") if coords else None,
            "left_percentage": bias_stats.get("left", 0),
            "right_percentage": bias_stats.get("right", 0),
            "neutral_percentage": bias_stats.get("neutral", 0)
        }
        try:
            response = requests.post(f"{SUPABASE_URL}/rest/v1/user_location_stats", headers=headers, json=payload, verify=False, timeout=5)
            if response.status_code in [200, 201]:
                print(f"Successfully logged location stats to Supabase for {location_name}")
            else:
                print(f"Failed to log location stats (status {response.status_code}): {response.text}")
        except Exception as e:
            print(f"Error logging to Supabase: {e}")
            
    return jsonify({"status": "success"})

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

import base64
DID_API_KEY = os.environ.get("DID_API_KEY", "MjUxMWNzMDIwNTk0QG1hbGxhcmVkZHl1bml2ZXJzaXR5LmFjLmlu:8pUa_Gi_zxZGI4GlGyDZV")
DID_AUTH_HEADER = f"Basic {base64.b64encode(DID_API_KEY.encode()).decode()}"

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    message = data.get("message", "")
    if not message:
        return jsonify({"error": "Message is required"}), 400
        
    if not client:
        return jsonify({"response": "I'm sorry, my AI backend is not active. But here is standard advice: always verify your sources!"})
        
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional AI news presenter for The Meridian. Keep your responses engaging, articulate, and under 3 sentences so they are suitable for speaking."
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
        )
        response_text = chat_completion.choices[0].message.content
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"response": f"I encountered an error querying the model: {e}"})

@app.route('/api/did-stream/create', methods=['POST'])
def did_create():
    data = request.json or {}
    source_url = data.get("source_url", "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png")
    
    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {
        "source_url": source_url
    }
    try:
        response = requests.post("https://api.d-id.com/talks/streams", headers=headers, json=payload, verify=False, timeout=10)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/did-stream/sdp', methods=['POST'])
def did_sdp():
    data = request.json or {}
    stream_id = data.get("stream_id")
    session_id = data.get("session_id")
    answer = data.get("answer")
    
    if not stream_id or not session_id or not answer:
        return jsonify({"error": "Missing parameters"}), 400
        
    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {
        "answer": answer,
        "session_id": session_id
    }
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}/sdp", headers=headers, json=payload, verify=False, timeout=10)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/did-stream/ice', methods=['POST'])
def did_ice():
    data = request.json or {}
    stream_id = data.get("stream_id")
    session_id = data.get("session_id")
    candidate = data.get("candidate")
    sdpMid = data.get("sdpMid")
    sdpMLineIndex = data.get("sdpMLineIndex")
    
    if not stream_id or not session_id or not candidate:
        return jsonify({"error": "Missing parameters"}), 400
        
    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {
        "candidate": candidate,
        "sdpMid": sdpMid,
        "sdpMLineIndex": sdpMLineIndex,
        "session_id": session_id
    }
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}/ice", headers=headers, json=payload, verify=False, timeout=10)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/did-stream/talk', methods=['POST'])
def did_talk():
    data = request.json or {}
    stream_id = data.get("stream_id")
    session_id = data.get("session_id")
    text = data.get("text", "")
    
    if not stream_id or not session_id or not text:
        return jsonify({"error": "Missing parameters"}), 400
        
    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {
        "script": {
            "type": "text",
            "subtitles": "false",
            "provider": {
                "type": "microsoft",
                "voice_id": "en-US-JennyNeural"
            },
            "input": text
        },
        "config": {
            "fluent": "false",
            "pad_audio": "0.0"
        },
        "session_id": session_id
    }
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}", headers=headers, json=payload, verify=False, timeout=10)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/did-stream/destroy', methods=['POST'])
def did_destroy():
    data = request.json or {}
    stream_id = data.get("stream_id")
    session_id = data.get("session_id")
    
    if not stream_id or not session_id:
        return jsonify({"error": "Missing parameters"}), 400
        
    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {
        "session_id": session_id
    }
    try:
        response = requests.delete(f"https://api.d-id.com/talks/streams/{stream_id}", headers=headers, json=payload, verify=False, timeout=10)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Running Flask app on port from Railway or fallback
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
