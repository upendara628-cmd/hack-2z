import time
import requests
import urllib3
import httpx
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from groq import Groq

# Disable SSL verification warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
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
                        val = parts[1].strip()
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        os.environ[parts[0].strip()] = val

CURRENTS_API_KEY = os.environ.get("CURRENTS_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
# NewsData.io API key (pub_... format)
NEWSDATA_KEY = os.environ.get("NEWSAPI_KEY", "pub_bccd32094e1d4c428735a806d84d71fc")
# ElevenLabs TTS key
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "sk_380904d5c047e5de307ecf7d491921867d4920ea141cc8e7")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")  # Sarah - natural female voice

# Initialize Groq Client
try:
    http_client = httpx.Client(verify=False)
    client = Groq(api_key=GROQ_API_KEY, http_client=http_client)
except Exception as e:
    print(f"Error initializing Groq client: {e}")
    client = None

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

CACHE_EXPIRY_SECONDS = 1800  # 30 minutes — longer cache = faster repeat loads
news_cache = {}

# ─────────────────────────────────────────────
# ElevenLabs TTS endpoint
# ─────────────────────────────────────────────
@app.route('/api/tts', methods=['POST'])
def get_tts():
    text = request.json.get("text", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    # 1. Try ElevenLabs TTS first if API key is present and not a placeholder
    if ELEVENLABS_API_KEY and not ELEVENLABS_API_KEY.startswith("sk_..."):
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY
            }
            data = {
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            response = requests.post(url, json=data, headers=headers, verify=False, timeout=10)
            if response.status_code == 200:
                print("ElevenLabs TTS generation successful.")
                return Response(response.content, mimetype="audio/mpeg")
            else:
                print(f"ElevenLabs TTS failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"ElevenLabs TTS error, falling back: {e}")

    # 2. Fallback to Google Translate TTS with SSL verification disabled
    try:
        import urllib.parse
        import re
        
        # Split text into chunks of roughly 150 chars to respect Google's limits
        sentences = re.split(r'(?<=[.!?]) +', text)
        chunks = []
        current_chunk = ""
        for s in sentences:
            if len(current_chunk) + len(s) < 150:
                current_chunk += s + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = s + " "
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        if not chunks:
            chunks = [text[:150]]
            
        full_audio = b""
        for chunk in chunks:
            if not chunk: continue
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q={urllib.parse.quote(chunk)}"
            headers = {'User-Agent': 'Mozilla/5.0'}
            try:
                resp = requests.get(url, headers=headers, verify=False, timeout=5)
                if resp.status_code == 200:
                    full_audio += resp.content
                else:
                    print(f"Google TTS chunk failed with status {resp.status_code}")
            except Exception as e:
                print(f"Error fetching Google TTS chunk: {e}")
                
        if full_audio:
            print("Google TTS fallback generation successful.")
            return Response(full_audio, mimetype="audio/mpeg")
        else:
            return jsonify({"error": "Failed to generate audio"}), 500
            
    except Exception as e:
        print(f"TTS Fallback Error: {e}")
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
# Auth check endpoint — checks Supabase
# ─────────────────────────────────────────────
@app.route('/api/auth/check', methods=['POST'])
def auth_check():
    """Check if an email has a registered account in Supabase."""
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        # No DB configured — allow all logins
        return jsonify({"exists": True, "message": "DB not configured, allowing login"})

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    try:
        url = f"{SUPABASE_URL}/rest/v1/users?email=eq.{email}&select=id,email,name"
        resp = requests.get(url, headers=headers, verify=False, timeout=8)
        if resp.status_code == 200:
            users = resp.json()
            if users:
                return jsonify({"exists": True, "user": users[0]})
            else:
                return jsonify({"exists": False, "message": "No account found with this email. Please sign up first."})
        else:
            print(f"[Supabase auth check] {resp.status_code}: {resp.text[:200]}")
            return jsonify({"exists": True, "message": "DB check failed, allowing login"})
    except Exception as e:
        print(f"[Supabase auth check error] {e}")
        return jsonify({"exists": True, "message": "DB unavailable, allowing login"})

@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    """Register a new user in Supabase."""
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    password = data.get("password", "").strip()

    if not email or not name:
        return jsonify({"error": "email and name are required"}), 400

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"success": True, "message": "Registered (DB not configured)"})

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload = {"email": email, "name": name, "created_at": "now()"}
    try:
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/users", headers=headers, json=payload, verify=False, timeout=8)
        if resp.status_code in [200, 201]:
            return jsonify({"success": True, "user": resp.json()[0] if resp.json() else {}})
        elif resp.status_code == 409:
            return jsonify({"error": "An account with this email already exists."}), 409
        else:
            print(f"[Supabase signup] {resp.status_code}: {resp.text[:300]}")
            return jsonify({"success": True, "message": "Registered (DB save pending)"})
    except Exception as e:
        print(f"[Supabase signup error] {e}")
        return jsonify({"success": True, "message": "Registered (DB unavailable)"})

# ─────────────────────────────────────────────
# Supabase cache helpers
# ─────────────────────────────────────────────
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

# ─────────────────────────────────────────────
# AI Bias Analysis
# ─────────────────────────────────────────────
def analyze_article_bias(title, description):
    if not client:
        return {"tone": "Neutral", "analysis": ["AI Analysis unavailable: Groq client not initialized."]}

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
        chat_completion = chat_with_retry(client, 
            messages=[
                {"role": "system", "content": "You are an impartial AI news analyst who analyzes political bias and omissions. You output strictly valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        import json
        result = json.loads(chat_completion.choices[0].message.content)
        tone = result.get("tone", "Neutral")
        if tone not in ["Left-Leaning", "Right-Leaning", "Neutral"]:
            tone = "Neutral"
        analysis = result.get("analysis", [])
        if not isinstance(analysis, list) or len(analysis) == 0:
            analysis = ["Analysis output was malformed or incomplete."]
        analysis = analysis[:3]
        while len(analysis) < 3:
            analysis.append("Neutral or balanced coverage overall.")
        return {"tone": tone, "analysis": analysis}
    except Exception as e:
        print(f"Error in Groq API analysis: {e}")
        return {
            "tone": "Neutral",
            "analysis": [
                "Could not perform bias analysis due to an error.",
                "Verify API connection and rate limits.",
                "Ensure article description contains sufficient text."
            ]
        }

# ─────────────────────────────────────────────
# News API — fetches from MULTIPLE sources
# Sources: CurrentsAPI, NewsData.io, GNews
# ─────────────────────────────────────────────
@app.route('/api/news', methods=['GET'])
def get_news():
    keyword = request.args.get('keyword', '').strip().lower()
    country = request.args.get('country', '').strip().lower()

    if keyword == 'politics':
        keyword = 'bjp congress politics'

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

    # Local memory cache
    now = time.time()
    if cache_key in news_cache:
        cached_item = news_cache[cache_key]
        if now - cached_item['timestamp'] < CACHE_EXPIRY_SECONDS:
            print(f"Serving cached news from local memory for key: {cache_key}")
            return jsonify(cached_item['data'])

    from concurrent.futures import ThreadPoolExecutor, as_completed
    import xml.etree.ElementTree as ET
    import re
    from urllib.parse import quote

    raw_articles = []
    sources_used = []
    sources_lock = __import__('threading').Lock()

    # ── PARALLEL fetch all 3 sources simultaneously ─────────────────────
    def fetch_currents():
        if not CURRENTS_API_KEY:
            return [], None
        try:
            news_url = "https://api.currentsapi.services/v1/search"
            params = {"country": country, "language": "en", "page_size": 5} if country else {"keywords": keyword, "language": "en", "page_size": 5}
            headers = {"Authorization": f"Bearer {CURRENTS_API_KEY}"}
            response = requests.get(news_url, headers=headers, params=params, verify=False, timeout=8)
            arts = response.json().get("news", [])
            result = [{
                "source": "CurrentsAPI",
                "id": a.get("id", ""),
                "title": a.get("title", ""),
                "description": a.get("description", ""),
                "url": a.get("url", "#"),
                "image": a.get("image", None),
                "author": a.get("author", "Staff Reporter") or "Staff Reporter",
                "time": a.get("published", "")[:16].replace("T", " ") if a.get("published") else "Recent"
            } for a in arts]
            label = "CurrentsAPI (currentsapi.services)" if result else None
            return result, label
        except Exception as e:
            print(f"[CurrentsAPI error] {e}")
            return [], None

    def fetch_newsdata():
        if not NEWSDATA_KEY:
            return [], None
        try:
            params_nd = {"country": country, "language": "en", "apikey": NEWSDATA_KEY, "size": 5} if country else {"q": keyword, "language": "en", "apikey": NEWSDATA_KEY, "size": 5}
            response = requests.get("https://newsdata.io/api/1/news", params=params_nd, verify=False, timeout=8)
            nd_data = response.json()
            arts = nd_data.get("results", [])
            if not isinstance(arts, list):
                return [], None
            result = [{
                "source": "NewsData.io",
                "id": a.get("article_id", a.get("link", "")),
                "title": a.get("title", ""),
                "description": a.get("description", "") or a.get("content", ""),
                "url": a.get("link", "#"),
                "image": a.get("image_url", None),
                "author": (a.get("creator") or ["Staff Reporter"])[0] if a.get("creator") else "Staff Reporter",
                "time": a.get("pubDate", "")[:16].replace("T", " ") if a.get("pubDate") else "Recent"
            } for a in arts]
            label = "NewsData.io (newsdata.io)" if result else None
            return result, label
        except Exception as e:
            print(f"[NewsData.io error] {e}")
            return [], None

    def fetch_gnews():
        try:
            gnews_q = country if country else keyword
            params_g = {"q": gnews_q, "lang": "en", "max": 5, "apikey": "1b31c10fdab5dc5e8bbbaab9b37a7a36"}
            response = requests.get("https://gnews.io/api/v4/search", params=params_g, verify=False, timeout=8)
            arts = response.json().get("articles", [])
            result = [{
                "source": "GNews",
                "id": a.get("url", ""),
                "title": a.get("title", ""),
                "description": a.get("description", ""),
                "url": a.get("url", "#"),
                "image": a.get("image", None),
                "author": a.get("source", {}).get("name", "Staff Reporter"),
                "time": a.get("publishedAt", "")[:16].replace("T", " ") if a.get("publishedAt") else "Recent"
            } for a in arts]
            label = "GNews (gnews.io)" if result else None
            return result, label
        except Exception as e:
            print(f"[GNews error] {e}")
            return [], None

    # Fire all 3 fetches at the same time
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = [ex.submit(fetch_currents), ex.submit(fetch_newsdata), ex.submit(fetch_gnews)]
        for fut in as_completed(futures):
            arts, label = fut.result()
            raw_articles.extend(arts)
            if label:
                sources_used.append(label)

    print(f"[News] Sources fetched: {sources_used}. Total raw articles: {len(raw_articles)}")

    # Deduplicate
    seen_titles = set()
    merged_articles = []
    for art in raw_articles:
        title_norm = art["title"].strip().lower() if art["title"] else ""
        if not title_norm or title_norm in seen_titles:
            continue
        seen_titles.add(title_norm)
        merged_articles.append(art)

    # Live scrape Google News RSS feed if all APIs failed
    if not merged_articles:
        print("All APIs returned no articles. Scraping live Google News RSS search feed...")
        try:
            query = keyword if keyword else (country if country else "world")
            rss_url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"
            response = requests.get(rss_url, verify=False, timeout=10)
            if response.status_code == 200:
                root = ET.fromstring(response.content)
                for item in root.findall(".//item"):
                    title = item.find("title").text if item.find("title") is not None else ""
                    link = item.find("link").text if item.find("link") is not None else "#"
                    pub_date = item.find("pubDate").text if item.find("pubDate") is not None else "Recent"
                    source_name = "Google News"
                    if " - " in title:
                        parts = title.split(" - ")
                        title = " - ".join(parts[:-1])
                        source_name = parts[-1]
                    desc = item.find("description").text if item.find("description") is not None else ""
                    if desc:
                        desc = re.sub(r'<[^>]*>', '', desc)
                    raw_articles.append({
                        "source": source_name, "id": link, "title": title,
                        "description": desc if desc else title, "url": link,
                        "image": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop",
                        "author": source_name, "time": pub_date[:16] if pub_date else "Recent"
                    })
                seen_titles = set()
                for art in raw_articles:
                    title_norm = art["title"].strip().lower() if art["title"] else ""
                    if not title_norm or title_norm in seen_titles:
                        continue
                    seen_titles.add(title_norm)
                    merged_articles.append(art)
        except Exception as e:
            print(f"[Google News RSS Scrape error] {e}")

    # Fallback if even live scraping returned nothing
    if not merged_articles:
        print("All APIs and live scraping failed. Serving fallback mock articles.")
        fallback_data = get_fallback_articles(keyword if keyword else country)
        return jsonify(fallback_data)

    merged_articles = merged_articles[:6]

    # ── PARALLEL AI Bias Analysis for all articles at once ──────────────
    def analyze_one(article):
        bias = analyze_article_bias(article["title"], article["description"])
        return {
            "id": article["id"],
            "title": article["title"],
            "description": article["description"],
            "url": article["url"],
            "image": article["image"] or "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop",
            "author": article["author"],
            "time": article["time"],
            "category": (keyword if keyword else "LOCAL").upper(),
            "source": article["source"],
            "bias_tone": bias["tone"],
            "bias_analysis": bias["analysis"],
            "sources_used": sources_used
        }

    processed_articles = [None] * len(merged_articles)
    with ThreadPoolExecutor(max_workers=6) as ex:
        future_map = {ex.submit(analyze_one, art): i for i, art in enumerate(merged_articles)}
        for fut in as_completed(future_map):
            idx = future_map[fut]
            try:
                processed_articles[idx] = fut.result()
            except Exception as e:
                print(f"[Bias analysis error] {e}")
                art = merged_articles[idx]
                processed_articles[idx] = {
                    "id": art["id"], "title": art["title"], "description": art["description"],
                    "url": art["url"], "image": art["image"] or "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop",
                    "author": art["author"], "time": art["time"],
                    "category": (keyword if keyword else "LOCAL").upper(),
                    "source": art["source"], "bias_tone": "Neutral",
                    "bias_analysis": ["Analysis unavailable.", "Please try again.", "Neutral coverage assumed."],
                    "sources_used": sources_used
                }

    # Filter out any None entries
    processed_articles = [a for a in processed_articles if a]

    news_cache[cache_key] = {"timestamp": now, "data": processed_articles}
    save_supabase_cache(cache_key, processed_articles)
    return jsonify(processed_articles)

@app.route('/api/news/sources', methods=['GET'])
def get_news_sources():
    """Returns which news websites/APIs are checked."""
    return jsonify({
        "sources": [
            {
                "name": "CurrentsAPI",
                "website": "currentsapi.services",
                "description": "Real-time global news from 50,000+ news sources worldwide",
                "coverage": "International, Breaking News, Politics, Technology, Science"
            },
            {
                "name": "NewsData.io",
                "website": "newsdata.io",
                "description": "Aggregates news from 80,000+ publishers across 200+ countries",
                "coverage": "All categories, Multi-language, Country-specific news"
            },
            {
                "name": "GNews",
                "website": "gnews.io",
                "description": "Google News-indexed articles from verified publishers",
                "coverage": "Top headlines, Topic-based search, International news"
            }
        ],
        "ai_analysis": "All articles are analyzed by Groq Llama-3.1 AI for political bias (Left-Leaning / Right-Leaning / Neutral) and omitted facts."
    })

@app.route('/api/location-stats', methods=['POST'])
def save_location_stats():
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    location_name = data.get("location_name", "Unknown")
    country_code = data.get("country_code", "unknown")

    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({"status": "ok", "message": "Location stats storage not configured"})

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    payload = {
        "location_name": location_name,
        "country_code": country_code,
        "visit_count": 1
    }
    try:
        response = requests.post(f"{SUPABASE_URL}/rest/v1/location_stats", headers=headers, json=payload, verify=False, timeout=5)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    message = data.get("message", "")
    email = data.get("email", "default_user")
    
    if not message:
        return jsonify({"error": "Message is required"}), 400

    if not client:
        return jsonify({"response": "I'm sorry, my AI backend is not active. But here is standard advice: always verify your sources!"})

    # Retrieve memories if email is provided
    memories_str = ""
    if email and email != "default_user":
        try:
            from mem0 import MemoryClient
            mem0_key = os.environ.get("MEMORY_API_KEY", "m0-AyoE7OGhjJ5DKJY6MHYQ4qeNH1BOEZt3xQPbp6Ys")
            m_client = MemoryClient(api_key=mem0_key)
            memories = m_client.get_all(filters={"user_id": email})
            if memories and "results" in memories:
                facts = [m["memory"] for m in memories["results"]]
                if facts:
                    memories_str = "\n".join(f"- {f}" for f in facts)
                    print(f"[Presenter Chat] Loaded memories for {email}: {memories_str}")
        except Exception as e:
            print(f"[Presenter Chat] Error loading memories: {e}")

    system_content = "You are Emma, a professional AI news presenter for The Meridian. Keep your responses engaging, articulate, and under 3 sentences so they are suitable for speaking aloud."
    if memories_str:
        system_content += f"\n\nUser Information (Memories from past interactions):\n{memories_str}"

    try:
        chat_completion = chat_with_retry(client, 
            messages=[
                {
                    "role": "system",
                    "content": system_content
                },
                {"role": "user", "content": message}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
        )
        response_text = chat_completion.choices[0].message.content

        # Save message context asynchronously in a background thread to prevent latency
        if email and email != "default_user":
            try:
                import threading
                def save_mem():
                    try:
                        from mem0 import MemoryClient
                        mem0_key = os.environ.get("MEMORY_API_KEY", "m0-AyoE7OGhjJ5DKJY6MHYQ4qeNH1BOEZt3xQPbp6Ys")
                        m_client = MemoryClient(api_key=mem0_key)
                        m_client.add(message, user_id=email)
                        print(f"[Presenter Chat] Saved memory for {email}: {message}")
                    except Exception as ex:
                        print(f"[Presenter Chat] Error saving memory: {ex}")
                threading.Thread(target=save_mem, daemon=True).start()
            except Exception as e:
                print(f"[Presenter Chat] Thread launch error: {e}")

        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"response": f"I encountered an error: {e}"})

@app.route('/api/article-read', methods=['POST'])
def article_read():
    data = request.json or {}
    url = (data.get('url') or '').strip()
    text = (data.get('text') or '').strip()

    if not url and not text:
        return jsonify({'error': 'Please provide article text or a URL.'}), 400

    if not article_groq_client:
        return jsonify({'error': 'Article AI client not initialized.'}), 503

    article_title = 'Provided Article'
    article_content = text

    if url:
        try:
            if 'wikipedia.org/wiki/' in url:
                content, title = fetch_wikipedia_text(url)
                if not content:
                    return jsonify({'error': title}), 400
                article_content = content
                article_title = title
            else:
                article_content = fetch_generic_url_text(url)
                article_title = url
        except Exception as e:
            return jsonify({'error': f'Failed to fetch URL: {str(e)}'}), 400

    prompt = f"""You are an alert news presenter. Read the article briefly and give a crisp 2-3 sentence summary that a listener can understand instantly. Keep it engaging and natural.

Title: {article_title}

Article:
{article_content[:3000]}
"""

    try:
        completion = article_groq_chat_with_retry(client, 
            messages=[
                {'role': 'system', 'content': 'You are a concise AI news reader that produces short, clear summaries for audio playback.'},
                {'role': 'user', 'content': prompt}
            ],
            model='llama-3.3-70b-versatile',
            temperature=0.4,
            max_tokens=300,
        )
        summary = completion.choices[0].message.content.strip()
        return jsonify({'summary': summary, 'title': article_title})
    except Exception as e:
        print(f'[ArticleRead] Groq summary error: {e}')
        return jsonify({'error': f'Failed to summarize article: {str(e)}'}), 500

# ─────────────────────────────────────────────────────────────────────
# Wikipedia / URL Article Analyzer with dedicated Groq key
# ─────────────────────────────────────────────────────────────────────
ARTICLE_GROQ_KEY = os.environ.get("ARTICLE_GROQ_KEY", os.environ.get("GROQ_API_KEY", ""))

try:
    article_http_client = httpx.Client(verify=False)
    article_groq_client = Groq(api_key=ARTICLE_GROQ_KEY, http_client=article_http_client)
    print("[ArticleAI] Dedicated Groq client initialized successfully.")
except Exception as e:
    article_groq_client = None
    print(f"[ArticleAI] Failed to initialize dedicated Groq client: {e}")


def fetch_wikipedia_text(url):
    """Extract clean text from a Wikipedia URL using the MediaWiki API."""
    import re
    from urllib.parse import urlparse, unquote

    parsed = urlparse(url)
    # Extract article title from URL path e.g. /wiki/Artificial_intelligence
    path = parsed.path
    title_match = re.search(r'/wiki/(.+)', path)
    if not title_match:
        return None, "Could not parse Wikipedia article title from URL."

    title = unquote(title_match.group(1)).replace('_', ' ')
    lang = parsed.hostname.split('.')[0] if parsed.hostname else 'en'

    api_url = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": True,
        "exsectionformat": "plain",
        "format": "json",
        "redirects": 1,
    }

    resp = requests.get(api_url, params=params, verify=False, timeout=15)
    data = resp.json()
    pages = data.get("query", {}).get("pages", {})
    for page_id, page in pages.items():
        if page_id == "-1":
            return None, f"Wikipedia article not found: {title}"
        extract = page.get("extract", "")
        # Limit to ~4000 chars for analysis
        return extract[:4000], title

    return None, "Failed to retrieve Wikipedia content."


def fetch_generic_url_text(url):
    """Fetch and extract readable text from any generic web URL."""
    import re
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(url, headers=headers, verify=False, timeout=15)
    resp.raise_for_status()
    # Strip HTML tags
    text = re.sub(r'<script[^>]*>[\s\S]*?</script>', ' ', resp.text)
    text = re.sub(r'<style[^>]*>[\s\S]*?</style>', ' ', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:4000]


@app.route('/api/article-analyze', methods=['POST'])
def analyze_article():
    data = request.json or {}
    url = (data.get("url") or "").strip()
    raw_text = (data.get("text") or "").strip()

    if not url and not raw_text:
        return jsonify({"error": "Either a URL or article text is required."}), 400

    if not article_groq_client:
        return jsonify({"error": "Article AI client not initialized."}), 503

    article_title = "Provided Article"
    article_content = raw_text

    # ── Fetch content from URL ────────────────────────────────────
    if url:
        try:
            if "wikipedia.org/wiki/" in url:
                content, title = fetch_wikipedia_text(url)
                if not content:
                    return jsonify({"error": title}), 400
                article_content = content
                article_title = title
                print(f"[ArticleAI] Fetched Wikipedia: {article_title} ({len(article_content)} chars)")
            else:
                article_content = fetch_generic_url_text(url)
                article_title = url
                print(f"[ArticleAI] Fetched generic URL: {url} ({len(article_content)} chars)")
        except Exception as e:
            return jsonify({"error": f"Failed to fetch URL: {str(e)}"}), 400

    # ── Deep Bias + Research Analysis via dedicated Groq key ──────
    system_prompt = """You are TruthLens ArticleAI, an expert investigative journalist and political analyst.
Your job is to perform a thorough, multi-dimensional bias and research analysis of any article, Wikipedia page, or text.

When analyzing, cover ALL of the following:
1. **Political Bias**: Is it Left, Right, or Center? Cite specific phrases or word choices.
2. **Source Framing**: What narrative does this article push? What is omitted?
3. **Factual Accuracy Check**: Which key claims are factually solid vs. questionable?
4. **Historical Context**: What broader context is missing or underemphasized?
5. **Perspectives Missing**: What viewpoints or voices are absent from this article?
6. **Language & Tone Analysis**: Is the language neutral, charged, emotional, or propagandistic?
7. **Summary Verdict**: Overall bias score (1-10 scale where 1=Far Left, 10=Far Right, 5=Neutral) and a one-line verdict.

Format your response clearly with bold headings for each section. Be concise but thorough."""

    user_prompt = f"""Please analyze this article for bias, framing, and research quality:

**Title:** {article_title}

**Content:**
{article_content[:3500]}

Provide a structured bias and research analysis as per your instructions."""

    try:
        completion = article_groq_chat_with_retry(client, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=1200,
        )
        analysis = completion.choices[0].message.content
        return jsonify({
            "title": article_title,
            "analysis": analysis,
            "content_length": len(article_content),
            "source_type": "wikipedia" if "wikipedia.org/wiki/" in url else ("url" if url else "text")
        })
    except Exception as e:
        print(f"[ArticleAI] Groq analysis error: {e}")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route('/api/assistant', methods=['POST'])
def assistant_chat():
    data = request.json or {}
    message = data.get("message", "")
    history = data.get("history", [])
    email = data.get("email", "default_user")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    if not client:
        return jsonify({"response": "I'm sorry, my AI backend is not active. Please check your GROQ_API_KEY."})

    # Retrieve memories if email is provided
    memories_str = ""
    if email and email != "default_user":
        try:
            from mem0 import MemoryClient
            mem0_key = os.environ.get("MEMORY_API_KEY", "m0-AyoE7OGhjJ5DKJY6MHYQ4qeNH1BOEZt3xQPbp6Ys")
            m_client = MemoryClient(api_key=mem0_key)
            memories = m_client.get_all(filters={"user_id": email})
            if memories and "results" in memories:
                facts = [m["memory"] for m in memories["results"]]
                if facts:
                    memories_str = "\n".join(f"- {f}" for f in facts)
                    print(f"[Assistant Chat] Loaded memories for {email}: {memories_str}")
        except Exception as e:
            print(f"[Assistant Chat] Error loading memories: {e}")

    system_content = "You are Nexus, a highly intelligent, helpful, and premium personal AI assistant built into The Meridian. You help the user analyze news trends, answer general queries, draft reports, explain complex world events, and assist with personal productivity. Keep your tone professional, articulate, and insightful. You are allowed to write detailed, structured, and formatted markdown responses."
    if memories_str:
        system_content += f"\n\nUser Information (Memories from past interactions):\n{memories_str}"

    try:
        messages = [
            {
                "role": "system",
                "content": system_content
            }
        ]

        for msg in history:
            role = msg.get("role")
            content = msg.get("content")
            if role in ["user", "assistant"]:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        chat_completion = chat_with_retry(client, 
            messages=messages,
            model="llama-3.1-8b-instant",
            temperature=0.7,
        )
        response_text = chat_completion.choices[0].message.content

        # Save message context asynchronously in a background thread to prevent latency
        if email and email != "default_user":
            try:
                import threading
                def save_mem():
                    try:
                        from mem0 import MemoryClient
                        mem0_key = os.environ.get("MEMORY_API_KEY", "m0-AyoE7OGhjJ5DKJY6MHYQ4qeNH1BOEZt3xQPbp6Ys")
                        m_client = MemoryClient(api_key=mem0_key)
                        m_client.add(message, user_id=email)
                        print(f"[Assistant Chat] Saved memory for {email}: {message}")
                    except Exception as ex:
                        print(f"[Assistant Chat] Error saving memory: {ex}")
                threading.Thread(target=save_mem, daemon=True).start()
            except Exception as e:
                print(f"[Assistant Chat] Thread launch error: {e}")

        return jsonify({"response": response_text})
    except Exception as e:
        print(f"[Assistant error] {e}")
        return jsonify({"response": f"I encountered an error: {e}"})



def chat_with_retry(client, *args, **kwargs):
    import time
    max_retries = 3
    for i in range(max_retries):
        try:
            return client.chat.completions.create(*args, **kwargs)
        except Exception as e:
            if '429' in str(e) or 'Rate limit' in str(e):
                if i < max_retries - 1:
                    time.sleep(3)
                    continue
            raise e

import base64

# D-ID Auth: encode the entire raw key as base64 for Basic auth
_DID_RAW = os.environ.get("DID_API_KEY", "c2FpODgwMjcyQGdtYWlsLmNvbQ:yewoHJS7LuLOwLLnkw2lN")
DID_AUTH_HEADER = f"Basic {base64.b64encode(_DID_RAW.encode()).decode()}"
print(f"[D-ID] Auth ready for: {_DID_RAW.split(':')[0][:20]}...")

@app.route('/api/did-stream/create', methods=['POST'])
def did_create():
    data = request.json or {}
    source_url = data.get("source_url", "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png")

    headers = {
        "Authorization": DID_AUTH_HEADER,
        "Content-Type": "application/json"
    }
    payload = {"source_url": source_url}
    try:
        response = requests.post("https://api.d-id.com/talks/streams", headers=headers, json=payload, verify=False, timeout=20)
        print(f"[D-ID create] Status: {response.status_code}, Body: {response.text[:300]}")
        try:
            resp_json = response.json()
        except Exception:
            return jsonify({"error": f"D-ID returned non-JSON (status {response.status_code}): {response.text[:200]}"}), 502
        if not response.ok:
            return jsonify({"error": resp_json.get('description', resp_json.get('message', str(resp_json)))}), response.status_code
        return jsonify(resp_json), response.status_code
    except requests.exceptions.Timeout:
        return jsonify({"error": "D-ID API timed out. Try again."}), 504
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

    headers = {"Authorization": DID_AUTH_HEADER, "Content-Type": "application/json"}
    payload = {"answer": answer, "session_id": session_id}
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}/sdp", headers=headers, json=payload, verify=False, timeout=15)
        print(f"[D-ID sdp] Status: {response.status_code}")
        try:
            return jsonify(response.json()), response.status_code
        except Exception:
            return jsonify({"ok": True}), response.status_code
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

    headers = {"Authorization": DID_AUTH_HEADER, "Content-Type": "application/json"}
    payload = {"candidate": candidate, "sdpMid": sdpMid, "sdpMLineIndex": sdpMLineIndex, "session_id": session_id}
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}/ice", headers=headers, json=payload, verify=False, timeout=10)
        try:
            return jsonify(response.json()), response.status_code
        except Exception:
            return jsonify({"ok": True}), response.status_code
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

    headers = {"Authorization": DID_AUTH_HEADER, "Content-Type": "application/json"}
    payload = {
        "script": {
            "type": "text",
            "subtitles": "false",
            "provider": {"type": "microsoft", "voice_id": "en-US-JennyNeural"},
            "input": text
        },
        "config": {"fluent": "false", "pad_audio": "0.0"},
        "session_id": session_id
    }
    try:
        response = requests.post(f"https://api.d-id.com/talks/streams/{stream_id}", headers=headers, json=payload, verify=False, timeout=15)
        print(f"[D-ID talk] Status: {response.status_code}")
        try:
            return jsonify(response.json()), response.status_code
        except Exception:
            return jsonify({"ok": True}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/did-stream/destroy', methods=['POST'])
def did_destroy():
    data = request.json or {}
    stream_id = data.get("stream_id")
    session_id = data.get("session_id")

    if not stream_id or not session_id:
        return jsonify({"error": "Missing parameters"}), 400

    headers = {"Authorization": DID_AUTH_HEADER, "Content-Type": "application/json"}
    payload = {"session_id": session_id}
    try:
        response = requests.delete(f"https://api.d-id.com/talks/streams/{stream_id}", headers=headers, json=payload, verify=False, timeout=10)
        try:
            return jsonify(response.json()), response.status_code
        except Exception:
            return jsonify({"ok": True}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/livekit-token', methods=['POST'])
def get_livekit_token():
    data = request.json or {}
    room_name = data.get("roomName", "default-room")
    participant_name = data.get("participantName", "user")
    
    api_key = (os.environ.get("LIVEKIT_API_KEY") or "").strip('"').strip("'")
    api_secret = (os.environ.get("LIVEKIT_API_SECRET") or "").strip('"').strip("'")
    server_url = (os.environ.get("LIVEKIT_URL") or "wss://ai-0aqosfgx.livekit.cloud").strip('"').strip("'")
    
    if not api_key or not api_secret:
        # Fallback to values from my-agent config if not explicitly set
        api_key = "APIqVVRjC8ZVqn3"
        api_secret = "elXjinoB4C1h2Ep0rfcZWQtnU2pbauhfysDzbTcsfuGA"
        
    try:
        from livekit import api
        token = api.AccessToken(api_key, api_secret)
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        ))
        token.with_identity(participant_name)
        
        # Configure automatic dispatch of our my-agent assistant on room connection
        token.with_room_config(api.RoomConfiguration(
            agents=[
                api.RoomAgentDispatch(
                    agent_name="my-agent"
                )
            ]
        ))
        
        return jsonify({
            "token": token.to_jwt(),
            "serverUrl": server_url
        })
    except ImportError:
        print("[LiveKit] livekit package not installed. Run: pip install livekit livekit-api")
        return jsonify({"error": "LiveKit voice agent not available in this environment. The text chat is fully functional."}), 503
    except Exception as e:
        print(f"[LiveKit token error] {e}")
        return jsonify({"error": f"LiveKit error: {str(e)}"}), 500

@app.route('/api/local-news', methods=['GET'])
def get_local_news():
    location = request.args.get("location", "Hyderabad").strip()
    language = request.args.get("language", "telugu").strip().lower()

    articles = []

    try:
        import xml.etree.ElementTree as ET
        import re
        from urllib.parse import quote

        if language == "telugu":
            query = f"{location} site:sakshi.com OR site:tv9telugu.com"
            rss_url = f"https://news.google.com/rss/search?q={quote(query)}&hl=te&gl=IN&ceid=IN:te"
        else:
            query = f"{location}"
            rss_url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"

        response = requests.get(rss_url, verify=False, timeout=10)
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            for item in root.findall('.//item'):
                title = item.find('title').text if item.find('title') is not None else ""
                url = item.find('link').text if item.find('link') is not None else "#"
                pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                
                if " - " in title:
                    title, source_name_parsed = title.rsplit(" - ", 1)
                else:
                    source_name_parsed = "Local News"

                description = ""
                image_url = ""
                desc_el = item.find('description')
                if desc_el is not None and desc_el.text:
                    # Parse image from RSS description HTML if available
                    img_match = re.search(r'<img[^>]+src="([^"]+)"', desc_el.text)
                    if img_match:
                        image_url = img_match.group(1)
                    
                    # Clean up description html tags
                    description = re.sub(r'<[^>]*>', '', desc_el.text)
                    if len(description) > 300:
                        description = description[:297] + "..."

                if "sakshi.com" in url:
                    source_name = "Sakshi"
                elif "tv9telugu.com" in url:
                    source_name = "TV9 Telugu"
                else:
                    source_name = source_name_parsed or "Local News"

                if not image_url or not image_url.startswith("http"):
                    image_pool = [
                        "1504711434969-e33886168f5c", # Newspaper pile
                        "1495020689067-958852a6565d", # Newspapers on table
                        "1585829365295-ab7cd400c167", # Reading newspaper
                        "1505373877841-8d25f7d46678", # Broadcasting studio
                        "1451187580459-43490279c0fa", # Tech globe
                        "1526470608268-f674ce90ebd4", # Studio cameras
                        "1508921912186-1d1a45ebb3c1", # Charminar India
                        "1581091226825-a6a2a5aee158", # Engineering lab
                        "1518770660439-4636190af475", # Chip
                        "1460925895917-afdab827c52f", # Financial charts
                        "1516321318423-f06f85e504b3", # Tablet reading
                        "1529107386315-e1a2ed48a620", # Government building
                        "1447069387593-a5de0862481e", # Vintage printing press
                        "1557804506-669a67965ba0"  # Politics meeting
                    ]
                    val = sum(ord(c) for c in title)
                    img_id = image_pool[val % len(image_pool)]
                    image_url = f"https://images.unsplash.com/photo-{img_id}?w=600&h=400&fit=crop"

                articles.append({
                    "id": url,
                    "title": title,
                    "description": description or f"Latest local news update from {source_name} in {location}.",
                    "url": url,
                    "image": image_url,
                    "author": source_name,
                    "time": pub_date,
                    "category": "LOCAL",
                    "source": source_name,
                    "bias_tone": "Neutral",
                    "bias_analysis": ["Analyzing political framing..."],
                    "sources_used": ["Google News RSS"]
                })
        
        articles = articles[:8]

        # Analyze bias using Groq for the top 3 articles
        for i in range(min(3, len(articles))):
            art = articles[i]
            try:
                bias_report = analyze_article_bias(art["title"], art["description"])
                art["bias_tone"] = bias_report["tone"]
                art["bias_analysis"] = bias_report["analysis"]
            except Exception as e:
                print(f"Error in local bias analysis: {e}")

        return jsonify(articles)
    except Exception as e:
        print(f"Error in local news endpoint: {e}")
        return jsonify(get_fallback_articles(location)), 200

def get_fallback_articles(topic="world"):
    return [
        {
            "id": "fallback-1", "title": f"Global Leaders Meet to Discuss {topic.title()} Policy",
            "description": "World leaders gathered at the international summit to address pressing global challenges and economic cooperation.",
            "url": "#", "image": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop",
            "author": "Staff Reporter", "time": "2026-07-17 10:00", "category": topic.upper(),
            "source": "Fallback", "bias_tone": "Neutral",
            "bias_analysis": ["No live data available.", "Check API keys in backend configuration.", "Fallback content is displayed."],
            "sources_used": []
        }
    ]

@app.route('/api/scrape-article', methods=['POST'])
def scrape_article():
    import traceback
    import sys
    url = request.json.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400
        
    # Auto-prepend scheme if missing
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
        
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        resp = requests.get(url, headers=headers, verify=False, timeout=10)
        if resp.status_code != 200:
            return jsonify({"error": f"Failed to fetch webpage: Status {resp.status_code}"}), 400
            
        html = resp.text
        import re
        
        # Strip noisy blocks
        html = re.sub(r'<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>', '', html, flags=re.I | re.S)
        html = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html, flags=re.I | re.S)
        html = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', html, flags=re.I | re.S)
        html = re.sub(r'<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>', '', html, flags=re.I | re.S)
        html = re.sub(r'<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>', '', html, flags=re.I | re.S)
        html = re.sub(r'<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>', '', html, flags=re.I | re.S)
        
        # Extract paragraph elements
        paragraphs = re.findall(r'<p\b[^>]*>(.*?)</p>', html, flags=re.I | re.S)
        if paragraphs:
            clean_paragraphs = []
            for p in paragraphs:
                p_clean = re.sub(r'<[^>]+>', ' ', p)
                p_clean = re.sub(r'\s+', ' ', p_clean).strip()
                if len(p_clean) > 30:
                    clean_paragraphs.append(p_clean)
            text = "\n\n".join(clean_paragraphs)
        else:
            text = re.sub(r'<[^>]+>', ' ', html)
            
        text = re.sub(r'\s+', ' ', text).strip()
        truncated_text = text[:3500]
        
        prompt = (
            "You are a web parsing AI. Extract the main article text and title from the following text. "
            "Ignore navigation and footers. Output only the clean article content:\n\n"
            f"{truncated_text}"
        )
        
        # Use fallback client if the main one is None
        g_client = client or article_groq_client
        if g_client is None:
            # Try to build one on the fly
            g_key = os.environ.get("GROQ_API_KEY", os.environ.get("ARTICLE_GROQ_KEY", ""))
            if g_key:
                g_client = Groq(api_key=g_key, http_client=httpx.Client(verify=False))
            else:
                return jsonify({"error": "Groq client is not initialized and no API key was found in environment."}), 500
        
        completion = chat_with_retry(g_client, 
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        article_content = completion.choices[0].message.content
        return jsonify({"article": article_content})
    except Exception as e:
        print(f"[Scrape error] {e}")
        traceback.print_exc()
        sys.stdout.flush()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
