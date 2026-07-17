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
                        os.environ[parts[0].strip()] = parts[1].strip()

CURRENTS_API_KEY = os.environ.get("CURRENTS_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
# NewsData.io API key (pub_... format)
NEWSDATA_KEY = os.environ.get("NEWSAPI_KEY", "pub_bccd32094e1d4c428735a806d84d71fc")
# ElevenLabs TTS key
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "sk_bc22642e245df2a68fe62c0d4063a5f27c250693e3011204")
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

CACHE_EXPIRY_SECONDS = 600  # 10 minutes
news_cache = {}

# ─────────────────────────────────────────────
# ElevenLabs TTS endpoint
# ─────────────────────────────────────────────
@app.route('/api/tts', methods=['POST'])
def tts():
    data = request.json or {}
    text = data.get("text", "").strip()
    voice_id = data.get("voice_id", ELEVENLABS_VOICE_ID)

    if not text:
        return jsonify({"error": "text is required"}), 400

    if not ELEVENLABS_API_KEY:
        return jsonify({"error": "ElevenLabs API key not configured"}), 503

    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3,
                "use_speaker_boost": True
            }
        }
        resp = requests.post(url, headers=headers, json=payload, verify=False, timeout=30, stream=True)

        if resp.status_code != 200:
            print(f"[ElevenLabs] Error {resp.status_code}: {resp.text[:300]}")
            return jsonify({"error": f"ElevenLabs error: {resp.status_code}"}), resp.status_code

        def generate():
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk

        return Response(generate(), mimetype="audio/mpeg",
                        headers={"Content-Disposition": "inline", "Cache-Control": "no-cache"})

    except requests.exceptions.Timeout:
        return jsonify({"error": "ElevenLabs request timed out"}), 504
    except Exception as e:
        print(f"[ElevenLabs] Exception: {e}")
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
        chat_completion = client.chat.completions.create(
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

    raw_articles = []
    sources_used = []

    # ── SOURCE 1: CurrentsAPI ──────────────────
    if CURRENTS_API_KEY:
        print(f"[Source 1] Fetching CurrentsAPI for {cache_key}...")
        try:
            news_url = "https://api.currentsapi.services/v1/search"
            if country:
                params = {"country": country, "language": "en", "page_size": 5}
            else:
                params = {"keywords": keyword, "language": "en", "page_size": 5}
            headers = {"Authorization": f"Bearer {CURRENTS_API_KEY}"}
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
            if articles_curr:
                sources_used.append("CurrentsAPI (currentsapi.services)")
        except Exception as e:
            print(f"[CurrentsAPI error] {e}")

    # ── SOURCE 2: NewsData.io ──────────────────
    if NEWSDATA_KEY:
        print(f"[Source 2] Fetching NewsData.io for {cache_key}...")
        try:
            if country:
                params_nd = {"country": country, "language": "en", "apikey": NEWSDATA_KEY, "size": 5}
            else:
                params_nd = {"q": keyword, "language": "en", "apikey": NEWSDATA_KEY, "size": 5}
            response = requests.get("https://newsdata.io/api/1/news", params=params_nd, verify=False, timeout=10)
            nd_data = response.json()
            articles_nd = nd_data.get("results", [])
            for art in articles_nd:
                raw_articles.append({
                    "source": "NewsData.io",
                    "id": art.get("article_id", art.get("link", "")),
                    "title": art.get("title", ""),
                    "description": art.get("description", "") or art.get("content", ""),
                    "url": art.get("link", "#"),
                    "image": art.get("image_url", None),
                    "author": (art.get("creator") or ["Staff Reporter"])[0] if art.get("creator") else "Staff Reporter",
                    "time": art.get("pubDate", "")[:16].replace("T", " ") if art.get("pubDate") else "Recent"
                })
            if articles_nd:
                sources_used.append("NewsData.io (newsdata.io)")
        except Exception as e:
            print(f"[NewsData.io error] {e}")

    # ── SOURCE 3: GNews (free tier) ───────────
    print(f"[Source 3] Fetching GNews for {cache_key}...")
    try:
        gnews_q = country if country else keyword
        params_g = {"q": gnews_q, "lang": "en", "max": 5, "apikey": "1b31c10fdab5dc5e8bbbaab9b37a7a36"}
        response = requests.get("https://gnews.io/api/v4/search", params=params_g, verify=False, timeout=10)
        gn_data = response.json()
        articles_gn = gn_data.get("articles", [])
        for art in articles_gn:
            raw_articles.append({
                "source": "GNews",
                "id": art.get("url", ""),
                "title": art.get("title", ""),
                "description": art.get("description", ""),
                "url": art.get("url", "#"),
                "image": art.get("image", None),
                "author": art.get("source", {}).get("name", "Staff Reporter"),
                "time": art.get("publishedAt", "")[:16].replace("T", " ") if art.get("publishedAt") else "Recent"
            })
        if articles_gn:
            sources_used.append("GNews (gnews.io)")
    except Exception as e:
        print(f"[GNews error] {e}")

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

    # Fallback if all APIs failed
    if not merged_articles:
        print("All APIs returned no articles. Serving fallback mock articles.")
        fallback_data = get_fallback_articles(keyword if keyword else country)
        return jsonify(fallback_data)

    merged_articles = merged_articles[:6]

    # AI Bias Analysis
    processed_articles = []
    for article in merged_articles:
        title = article["title"]
        description = article["description"]
        safe_title = title[:50].encode('ascii', errors='ignore').decode('ascii')
        print(f"Analyzing: {safe_title}...")
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
            "bias_analysis": bias_report["analysis"],
            "sources_used": sources_used
        })

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
    if not message:
        return jsonify({"error": "Message is required"}), 400

    if not client:
        return jsonify({"response": "I'm sorry, my AI backend is not active. But here is standard advice: always verify your sources!"})

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are Emma, a professional AI news presenter for The Meridian. Keep your responses engaging, articulate, and under 3 sentences so they are suitable for speaking aloud."
                },
                {"role": "user", "content": message}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
        )
        response_text = chat_completion.choices[0].message.content
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"response": f"I encountered an error: {e}"})

import base64

# D-ID Auth: encode the entire raw key as base64 for Basic auth
_DID_RAW = os.environ.get("DID_API_KEY", "dXBlbmRhcmE2MjhAZ21haWwuY29t:SZq4-ViEXjqdbVM6cbDAy")
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

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
