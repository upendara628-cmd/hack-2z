# 🗞️ The Meridian — AI-Powered News Portal

> A next-generation news aggregator with an interactive AI presenter, real-time bias analysis, and multi-source news aggregation.

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| **Frontend** | [https://meridian-news.netlify.app](https://meridian-news.netlify.app) |
| **Backend API** | [https://meridian-news-backend.onrender.com](https://meridian-news-backend.onrender.com) |

---

## ✨ Features

### 🎙️ Interactive AI Presenter (Emma)
- **ElevenLabs AI Voice** — Natural human-quality voice (Sarah voice model)
- **D-ID Live Avatar** — Photorealistic talking head with lip-sync via WebRTC
- **Groq LLaMA Chat** — Ask Emma any news question and she'll answer intelligently
- **Daily News Briefing** — Emma reads the top 3 headlines aloud in broadcast style

### 📡 Multi-Source News Aggregation
The app checks **3 different news websites simultaneously**:

| Source | Website | Coverage |
|--------|---------|----------|
| **CurrentsAPI** | currentsapi.services | 50,000+ global sources, breaking news |
| **NewsData.io** | newsdata.io | 80,000+ publishers across 200+ countries |
| **GNews** | gnews.io | Google News-indexed verified publishers |

### 🤖 AI Bias Analysis
Every article is analyzed by **Groq Llama-3.1-8b** for:
- Political bias classification: `Left-Leaning` / `Right-Leaning` / `Neutral`
- 3 bullet-point analysis of framing, omitted facts, and tone

### 🔐 Authentication
- **Google OAuth** sign-in
- **Email/Password** login with Supabase DB validation
- Smart auth flow: if no account exists → prompts to sign up with one click
- All user data stored in **Supabase** PostgreSQL

### 🗂️ News Categories
- Politics, Technology, Science, World, Sports
- Country-specific news filtering
- Trending topics sidebar

---

## 🏗️ Architecture

```
hackthon/
├── frontend/          # React 18 app (Create React App)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AiPresenter.jsx    # D-ID + ElevenLabs presenter
│   │   │   ├── Login.jsx          # Glassmorphic auth UI
│   │   │   ├── Header.jsx
│   │   │   ├── FeaturedArticle.jsx
│   │   │   ├── PoliticsSection.jsx
│   │   │   ├── TechnologySection.jsx
│   │   │   ├── TrendingSection.jsx
│   │   │   ├── CategoryView.jsx
│   │   │   ├── UserDashboard.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── utils/
│   │   │   └── did-stream.js      # D-ID WebRTC manager
│   │   ├── config.js              # API base URL config
│   │   └── App.jsx
│   └── public/
│       └── index.html             # Google GSI script
│
├── backend/           # Python Flask API
│   └── app.py         # All API routes
│
├── .env               # Environment variables (not committed)
├── render.yaml        # Render.com deployment blueprint
└── setup_supabase.sql # Supabase schema setup
```

---

## 🔑 API Keys & Services

| Service | Purpose | Key Variable |
|---------|---------|-------------|
| **D-ID** | Live avatar streaming (WebRTC) | `DID_API_KEY` |
| **ElevenLabs** | Natural AI voice TTS | `ELEVENLABS_API_KEY` |
| **Groq** | LLaMA-3.1 chat & bias analysis | `GROQ_API_KEY` |
| **NewsData.io** | News aggregation (pub_ key) | `NEWSAPI_KEY` |
| **CurrentsAPI** | News aggregation | `CURRENTS_API_KEY` |
| **Supabase** | PostgreSQL DB + auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Google OAuth** | Social login | Client ID in `Login.jsx` |

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd hackthon

# Activate virtual environment
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Start Flask server
python backend/app.py
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

### Environment Variables (`.env` in root)
```env
GROQ_API_KEY=your_groq_key
CURRENTS_API_KEY=your_currents_key
NEWSAPI_KEY=pub_bccd32094e1d4c428735a806d84d71fc
DID_API_KEY=base64email:secret_key
ELEVENLABS_API_KEY=sk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🗃️ Supabase Database Schema

Run `setup_supabase.sql` in your Supabase SQL editor:

```sql
-- Users table (for auth)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- News cache table
CREATE TABLE news_cache (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  url TEXT,
  image TEXT,
  author TEXT,
  time TEXT,
  category TEXT,
  source TEXT,
  bias_tone TEXT,
  bias_analysis JSONB,
  cache_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🎭 D-ID Avatar — Known Issue & How It Works

The D-ID live avatar uses **WebRTC** streaming. Here's what happens when you click "Initialize":

1. Backend creates a D-ID stream session (`POST /api/did-stream/create`) → returns ICE servers + SDP offer
2. Frontend creates `RTCPeerConnection`, sets remote description
3. Frontend creates SDP answer, sends it back to D-ID
4. ICE candidate exchange completes the WebRTC handshake
5. D-ID sends video track → `video.srcObject` set → video displays
6. After 2 seconds, `talk()` is called → **Emma's face animates with lip-sync**

> ⚠️ **The avatar only shows Emma's face when she is actively speaking** (calling `/api/did-stream/talk`). While idle, the stream is connected but the video is a static/idle frame. ElevenLabs voice plays independently and instantly.

### D-ID Auth Format
D-ID API keys follow the format: `base64(email):secret_key`  
The backend encodes the **entire** raw string as Base64 for Basic auth:
```python
DID_AUTH_HEADER = f"Basic {base64.b64encode(raw_key.encode()).decode()}"
```

---

## 🌐 Deployment (Render + Netlify)

### Backend → Render.com
- Service type: **Web Service**
- Build command: `pip install -r backend/requirements.txt`
- Start command: `gunicorn app:app`
- Root directory: `backend/`
- Add all env vars in Render dashboard

### Frontend → Netlify
- Base directory: `frontend/`
- Build command: `npm run build`
- Publish directory: `frontend/build`
- Set `REACT_APP_API_URL=https://meridian-news-backend.onrender.com`

### Google OAuth — Required Setup
Add these **Authorized JavaScript Origins** in [Google Cloud Console](https://console.cloud.google.com/):
```
http://localhost:3000
https://meridian-news.netlify.app
```

---

## 📚 API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/api/news?keyword=politics` | Fetch news from all 3 sources |
| `GET` | `/api/news/sources` | List all news websites checked |
| `POST` | `/api/chat` | Chat with Emma (Groq AI) |
| `POST` | `/api/tts` | ElevenLabs text-to-speech |
| `POST` | `/api/auth/check` | Check if user has account in DB |
| `POST` | `/api/auth/signup` | Register new user in Supabase |
| `POST` | `/api/did-stream/create` | Create D-ID WebRTC session |
| `POST` | `/api/did-stream/sdp` | Exchange SDP answer |
| `POST` | `/api/did-stream/ice` | Send ICE candidates |
| `POST` | `/api/did-stream/talk` | Make avatar speak |
| `POST` | `/api/did-stream/destroy` | End D-ID session |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vanilla CSS |
| Backend | Python Flask, Flask-CORS |
| AI Voice | ElevenLabs (Turbo v2.5) |
| AI Avatar | D-ID (WebRTC streaming) |
| AI Chat | Groq (LLaMA-3.1-8b-instant) |
| Database | Supabase (PostgreSQL) |
| News APIs | CurrentsAPI, NewsData.io, GNews |
| Auth | Google OAuth 2.0 (GSI) + Email/Password |
| Deployment | Render (backend) + Netlify (frontend) |

---

## 👥 Team

Built for **Hackathon 2026** by Team Meridian.

---

*© 2026 The Meridian. All rights reserved.*
