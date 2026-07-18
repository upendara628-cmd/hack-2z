# 🗞️ The Meridian — AI-Powered News Portal

> A next-generation news aggregator with an interactive AI presenter, **NEXUS AI personal assistant**, real-time bias analysis, multi-source news aggregation, and a live voice agent powered by LiveKit.

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| **Frontend** | [https://meridian-news.netlify.app](https://meridian-news.netlify.app) |
| **Backend API** | [https://meridian-news-backend.onrender.com](https://meridian-news-backend.onrender.com) |

---

## ✨ Features

### 🧠 NEXUS AI — Personal Assistant
- **Text Chat** — Ask Nexus anything: summarize news, draft reports, explain bias, answer general queries
- **🎙️ Voice Agent (LiveKit)** — Real-time voice calls powered by LiveKit WebRTC, Deepgram STT, Cartesia TTS
- **Memory (Mem0)** — Nexus remembers past conversations and personalizes responses per user
- **Markdown Responses** — Rich, formatted AI responses rendered beautifully in the chat panel
- **Quick Prompts** — One-click suggested topics like "Summarize Tech News" or "Analyze Politics Bias"

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

### 📰 Article Reader & AI Summarizer
- Paste any URL or Wikipedia link to get an AI-generated summary
- Deep content extraction using **Groq Llama-3.3-70b-versatile**
- Supports news articles, Wikipedia pages, and raw text

### 🌍 Interactive 3D Globe
- Rotating globe showing real-time global news hotspots
- Click any country to filter news from that region
- Built with `react-globe.gl` and WebGL

### 📍 Local News Edition
- Switch between **World Edition** and **Local Edition**
- Detects user location and fetches nearby news sources

### 🔐 Authentication
- **Google OAuth** sign-in
- **Email/Password** login with Supabase DB validation
- Smart auth flow: if no account exists → prompts to sign up with one click
- All user data stored in **Supabase** PostgreSQL

### 🗂️ News Categories
- Politics, Technology, Science, World, Sports, Opinion
- Country-specific news filtering
- Trending topics sidebar

---

## 🏗️ Architecture

```
hackthon/
├── frontend/                  # React 18 app (Create React App)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AiPresenter.jsx        # D-ID + ElevenLabs presenter
│   │   │   ├── PersonalAssistant.jsx  # NEXUS AI text + voice chat
│   │   │   ├── Login.jsx              # Glassmorphic auth UI
│   │   │   ├── Header.jsx
│   │   │   ├── FeaturedArticle.jsx
│   │   │   ├── PoliticsSection.jsx
│   │   │   ├── TechnologySection.jsx
│   │   │   ├── TrendingSection.jsx
│   │   │   ├── CategoryView.jsx
│   │   │   ├── SearchView.jsx
│   │   │   ├── GlobeView.jsx          # 3D interactive globe
│   │   │   ├── LocalNewsSection.jsx   # Location-based news
│   │   │   ├── UserDashboard.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── utils/
│   │   │   └── did-stream.js          # D-ID WebRTC manager
│   │   ├── config.js                  # API base URL config
│   │   └── App.jsx
│   └── public/
│       └── index.html                 # Google GSI script
│
├── backend/                   # Python Flask API
│   └── app.py                 # All API routes
│
├── extra/
│   ├── my-agent/              # LiveKit Voice Agent (Python)
│   │   └── src/agent.py       # NEXUS voice assistant agent
│   └── login-page/            # Standalone login UI (Vite + React)
│
├── .env                       # Environment variables (not committed)
├── render.yaml                # Render.com deployment blueprint
└── setup_supabase.sql         # Supabase schema setup
```

---

## 🔑 API Keys & Services

| Service | Purpose | Key Variable |
|---------|---------|-------------|
| **D-ID** | Live avatar streaming (WebRTC) | `DID_API_KEY` |
| **ElevenLabs** | Natural AI voice TTS | `ELEVENLABS_API_KEY` |
| **Groq** | LLaMA-3.1 chat & bias analysis | `GROQ_API_KEY` |
| **Groq (Article)** | Article summarizer (dedicated key) | `ARTICLE_GROQ_KEY` |
| **NewsData.io** | News aggregation (pub_ key) | `NEWSAPI_KEY` |
| **CurrentsAPI** | News aggregation | `CURRENTS_API_KEY` |
| **Supabase** | PostgreSQL DB + auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Mem0** | Persistent AI memory for NEXUS | `MEMORY_API_KEY` |
| **LiveKit** | Voice agent WebRTC infrastructure | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| **Google OAuth** | Social login | Client ID in `Login.jsx` |

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend (Flask API)
```bash
cd hackthon

# Activate virtual environment
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Start Flask server
python backend/app.py
# Runs on http://localhost:5000
```

### 2. Frontend (React)
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

### 3. NEXUS Voice Agent (LiveKit)
```bash
cd extra/my-agent/my-agent

# Activate virtual environment
.venv\Scripts\activate      # Windows

# Run the agent in dev mode
python src/agent.py dev
# Agent registers with LiveKit Cloud and waits for room connections
```

### Environment Variables (`.env` in root)
```env
GROQ_API_KEY=your_groq_key
ARTICLE_GROQ_KEY=your_article_groq_key   # optional, falls back to GROQ_API_KEY
CURRENTS_API_KEY=your_currents_key
NEWSAPI_KEY=your_newsdata_key
DID_API_KEY=base64email:secret_key
ELEVENLABS_API_KEY=sk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MEMORY_API_KEY=your_mem0_key
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud
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

## 🎙️ NEXUS AI Voice Agent — How It Works

The NEXUS voice call uses **LiveKit WebRTC** for real-time audio streaming:

1. Frontend calls `POST /api/livekit-token` → backend generates a JWT room token with `my-agent` dispatch
2. Frontend connects to LiveKit Cloud room using `livekit-client`
3. LiveKit Cloud dispatches the job to the running **Python agent** (`extra/my-agent/my-agent/src/agent.py`)
4. Agent joins the same room, loads user memories from **Mem0**, and starts a voice session
5. Voice pipeline: **Deepgram Nova-3 STT** → **Gemma 4B LLM** → **Cartesia Sonic-3 TTS**
6. Agent says a personalized greeting, then listens and responds in real-time

> 💡 **The voice agent must be running locally** (`python src/agent.py dev`) for voice calls to work in development.

---

## 🎭 D-ID Avatar — How It Works

The D-ID live avatar uses **WebRTC** streaming. Here's what happens when you click "Initialize":

1. Backend creates a D-ID stream session (`POST /api/did-stream/create`) → returns ICE servers + SDP offer
2. Frontend creates `RTCPeerConnection`, sets remote description
3. Frontend creates SDP answer, sends it back to D-ID
4. ICE candidate exchange completes the WebRTC handshake
5. D-ID sends video track → `video.srcObject` set → video displays
6. After 2 seconds, `talk()` is called → **Emma's face animates with lip-sync**

> ⚠️ **The avatar only shows Emma's face when she is actively speaking** (calling `/api/did-stream/talk`). While idle, the stream is connected but the video is a static/idle frame. ElevenLabs voice plays independently and instantly.

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

### Voice Agent → LiveKit Cloud (or self-hosted)
- Deploy `extra/my-agent/my-agent/` as a Docker container
- Use the included `Dockerfile`
- Set all env vars including `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

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
| `POST` | `/api/assistant` | Chat with NEXUS AI (Groq + Mem0) |
| `POST` | `/api/livekit-token` | Generate LiveKit room token for voice agent |
| `POST` | `/api/article/read` | Summarize article by URL or text |
| `POST` | `/api/article/analyze` | Deep AI analysis of article |
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
| AI Chat | Groq (LLaMA-3.1-8b-instant) |
| AI Analysis | Groq (LLaMA-3.3-70b-versatile) |
| AI Voice (TTS) | ElevenLabs (Turbo v2.5) + Cartesia Sonic-3 |
| AI Voice (STT) | Deepgram Nova-3 |
| AI Avatar | D-ID (WebRTC streaming) |
| Voice Agent | LiveKit Agents (Python SDK v1.6.5) |
| AI Memory | Mem0 MemoryClient |
| Globe | react-globe.gl (WebGL / Three.js) |
| Database | Supabase (PostgreSQL) |
| News APIs | CurrentsAPI, NewsData.io, GNews |
| Auth | Google OAuth 2.0 (GSI) + Email/Password |
| Deployment | Render (backend) + Netlify (frontend) |

---

## 👥 Team

Built for **Hackathon 2026** by Team Meridian.

---

*© 2026 The Meridian. All rights reserved.*
