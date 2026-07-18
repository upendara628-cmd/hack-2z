import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DIDStreamManager } from '../utils/did-stream';
import { API_BASE_URL } from '../config';

const AiPresenter = ({ user }) => {
  const videoRef = useRef(null);
  const streamManagerRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const didInitialized = useRef(false);
  const welcomedRef = useRef(false);

  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [useDID, setUseDID] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [micSupported, setMicSupported] = useState(false);

  // Article reader state
  const [articleText, setArticleText] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [articleInputType, setArticleInputType] = useState('text'); // 'text' | 'link'
  const [useNotebookLMStyle, setUseNotebookLMStyle] = useState(false);
  const [articleTab, setArticleTab] = useState('voice'); // 'voice' | 'article'

  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Emma, your AI News Presenter. Click "Initialize" to start, then hold the 🎤 mic button and speak your question — or paste any article for me to read!' }
  ]);
  const [newsSources, setNewsSources] = useState(null);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const [podcastStage, setPodcastStage] = useState('');
  const [podcastProgressPercent, setPodcastProgressPercent] = useState(0);
  const [isRenderingPodcast, setIsRenderingPodcast] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/news/sources`)
      .then(r => r.json())
      .then(data => setNewsSources(data))
      .catch(() => {});
    // Check mic availability
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setMicSupported(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamManagerRef.current) streamManagerRef.current.destroy().catch(() => {});
      if (audioRef.current) { audioRef.current.pause(); }
      if (recognitionRef.current) recognitionRef.current.abort();
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── ElevenLabs TTS ─────────────────────────────────────────────
  const speakWithBrowserTTS = useCallback((text) => {
    window.speechSynthesis.cancel();
    setCurrentSpeech(text);
    setIsSpeaking(true);
    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        (v.name.includes('Google') && v.lang.startsWith('en')) ||
        (v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
        v.lang === 'en-US'
      );
      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      utterance.onend = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); };
      utterance.onerror = () => { setIsSpeaking(false); setCurrentSpeech(''); };
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length > 0) doSpeak();
    else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
  }, []);

  const speakResponse = useCallback(async (text, autoPlay = true) => {
    if (autoPlay) {
      setCurrentSpeech(text);
      setIsSpeaking(true);
      setConnectionStatus('Speaking...');
      
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
      if (streamManagerRef.current && didInitialized.current && streamManagerRef.current.streamId) {
        streamManagerRef.current.talk(text).catch(err => console.warn('D-ID talk error:', err));
      } else if (streamManagerRef.current && didInitialized.current) {
        console.log('[D-ID] Stream connection still negotiating. Queueing talk text.');
        const checkReady = setInterval(() => {
          if (streamManagerRef.current && streamManagerRef.current.streamId) {
            clearInterval(checkReady);
            streamManagerRef.current.talk(text).catch(err => console.warn('D-ID talk error:', err));
          }
        }, 200);
        setTimeout(() => clearInterval(checkReady), 6000);
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('ElevenLabs TTS failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setLastAudioBlob(audioBlob);
      setLastAudioUrl(prevUrl => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return audioUrl;
      });
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = audioUrl;
      audioRef.current.onended = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); };
      audioRef.current.onerror = () => { setIsSpeaking(false); setCurrentSpeech(''); };
      if (autoPlay) {
        await audioRef.current.play();
      }
    } catch (err) {
      if (autoPlay) {
        if (err.name === 'AbortError') {
          console.log('[TTS] Audio playback was interrupted by a new request or pause.');
          return;
        }
        console.warn('ElevenLabs failed, using browser TTS', err);
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_`]/g, '');
        const doSpeak = () => {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          window.currentUtterance = utterance; // Prevent GC bug
          const voices = window.speechSynthesis.getVoices();
          const premiumVoice = voices.find(v => (v.name.includes('Google') && v.lang.startsWith('en')) || (v.name.includes('Natural') && v.lang.startsWith('en')) || v.lang === 'en-US');
          if (premiumVoice) utterance.voice = premiumVoice;
          utterance.onend = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); };
          utterance.onerror = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); };
          window.speechSynthesis.speak(utterance);
        };
        if (window.speechSynthesis.getVoices().length > 0) doSpeak();
        else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; setTimeout(doSpeak, 1000); }
      }
    }
  }, []);

  // ── D-ID init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isSessionStarted) return;
    if (didInitialized.current) return;
    didInitialized.current = true;
    const initDID = async () => {
      if (!videoRef.current) return;
      try {
        const manager = new DIDStreamManager(videoRef.current, (status) => {
          setConnectionStatus(status);
          if (status === 'Connected' || status === 'Waiting for avatar...') setUseDID(true);
        });
        streamManagerRef.current = manager;
        await manager.connect();
        setUseDID(true);
        let attempts = 0;
        const checkVideo = setInterval(() => {
          const vid = videoRef.current;
          attempts++;
          if (vid && vid.srcObject && vid.readyState >= 2 && !vid.paused) {
            clearInterval(checkVideo);
            vid.muted = false;
            setVideoReady(true);
            setConnectionStatus('Connected');
            
            // Speak the welcome greeting when successfully connected to D-ID stream!
            if (!welcomedRef.current) {
              welcomedRef.current = true;
              speakResponse('Hello! I am Emma, your AI News Presenter from Truth Lens. Hold the microphone button and speak your question, or paste an article for me to read aloud!');
            }
          }
          // Removing max attempts limitation so it can eventually show if it takes longer than 12s
        }, 300);
      } catch (err) {
        setUseDID(false);
        setVideoReady(false);
      }
    };
    initDID();
  }, [isSessionStarted]);

  // ── Session start ──────────────────────────────────────────────
  const handleStartSession = async () => {
    // Unlock Audio Contexts synchronously on user click to bypass autoplay restrictions
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // silent wav
    audioRef.current.play().catch(() => {});

    setIsSessionStarted(true);
    setConnectionStatus('Connecting...');
    
    // Safety fallback: if connection takes longer than 6 seconds, welcome the user anyway
    setTimeout(() => {
      if (!welcomedRef.current) {
        welcomedRef.current = true;
        setConnectionStatus('Emma is ready');
        speakResponse('Hello! I am Emma, your AI News Presenter from Truth Lens. Hold the microphone button and speak your question, or paste an article for me to read aloud!');
      }
    }, 6000);
  };

  const handleStopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (recognitionRef.current) recognitionRef.current.abort();
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsListening(false);
    setCurrentSpeech('');
    setConnectionStatus('Emma is ready');
  };

  // ── Voice input (Web Speech API) ───────────────────────────────
  const startListening = () => {
    if (!micSupported || isThinking || isSpeaking) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    setVoiceTranscript('');
    latestTranscriptRef.current = '';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setVoiceTranscript(transcript);
      latestTranscriptRef.current = transcript;
    };
    recognition.onend = () => {
      setIsListening(false);
      const finalTranscript = latestTranscriptRef.current;
      if (finalTranscript.trim()) handleSendVoiceMessage(finalTranscript.trim());
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceTranscript('');
    };
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSendVoiceMessage = useCallback(async (text) => {
    if (!text.trim() || isThinking) return;
    setChatMessages(prev => [...prev, { sender: 'user', text }]);
    setVoiceTranscript('');
    setIsThinking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, email: user?.email })
      });
      const data = await response.json();
      const aiResponse = data.response || 'I could not retrieve a reply. Please try again.';
      setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
      await speakResponse(aiResponse);
    } catch (err) {
      const errorMsg = "I'm having trouble connecting right now. Please try again.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: errorMsg }]);
      await speakResponse(errorMsg);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, speakResponse]);

  const handleDownloadMp3 = () => {
    if (!lastAudioBlob) return;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = lastAudioUrl;
    a.download = `podcast_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Article Reader ─────────────────────────────────────────────
  const handleReadArticle = async () => {
    let sourceText = "";
    
    setIsThinking(true);
    
    try {
      if (articleInputType === 'link') {
        if (!articleUrl.trim()) return;
        setChatMessages(prev => [...prev, {
          sender: 'user',
          text: `🔗 [Scraping Link]: ${articleUrl}`
        }]);
        
        const scrapeRes = await fetch(`${API_BASE_URL}/api/scrape-article`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: articleUrl })
        });
        if (!scrapeRes.ok) {
          const errData = await scrapeRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Scraping failed');
        }
        const scrapeData = await scrapeRes.json();
        sourceText = scrapeData.article || '';
      } else {
        if (!articleText.trim()) return;
        sourceText = articleText.trim();
        setChatMessages(prev => [...prev, {
          sender: 'user',
          text: `📄 [Article submitted for reading]\n\n${sourceText.slice(0, 120)}...`
        }]);
      }

      if (!sourceText.trim()) {
        throw new Error('No article content found');
      }

      const truncated = sourceText.slice(0, 4000);
      let prompt = `Please give me a brief, clear spoken summary of this article in 3-4 sentences, as if you are a news presenter reading it on air:\n\n${truncated}`;
      
      if (useNotebookLMStyle) {
        prompt = `You are a podcast host like Google NotebookLM. Generate a deep, engaging, and highly conversational audio overview of this article. Explain the key concepts, highlight what is fascinating, and present it in a lively monologue. Keep it brief (exactly 4-5 sentences of natural, spoken speech). Do not use bullet points, headers, or markdown formatting:\n\n${truncated}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, email: user?.email })
      });
      const data = await response.json();
      const aiResponse = data.response || 'Unable to summarize the article.';
      
      if (useNotebookLMStyle) {
        setIsRenderingPodcast(true);
        setPodcastProgressPercent(0);
        setPodcastStage("🎙️ Step 1/4: Analyzing scraped content & structuring script...");

        // Pre-fetch TTS in background (do not play yet)
        const ttsPromise = speakResponse(aiResponse, false);

        // Run the 20-second timer
        let seconds = 0;
        const totalDuration = 20;
        const timer = setInterval(() => {
          seconds += 1;
          const pct = Math.floor((seconds / totalDuration) * 100);
          setPodcastProgressPercent(pct);

          if (seconds < 5) {
            setPodcastStage("🎙️ Step 1/4: Analyzing scraped content & structuring script...");
          } else if (seconds < 10) {
            setPodcastStage("🧬 Step 2/4: Applying conversational speaker tone and inflection...");
          } else if (seconds < 15) {
            setPodcastStage("🎚️ Step 3/4: Balancing frequencies, gain, and noise threshold...");
          } else if (seconds < 20) {
            setPodcastStage("💾 Step 4/4: Finalizing master track & packaging into MP3...");
          } else {
            clearInterval(timer);
          }
        }, 1000);

        // Wait for both timer and TTS promise
        await Promise.all([
          new Promise(resolve => setTimeout(resolve, totalDuration * 1000)),
          ttsPromise.catch(err => console.warn("Background TTS fetch failed:", err))
        ]);

        setIsRenderingPodcast(false);
        setChatMessages(prev => [...prev, { 
          sender: 'ai', 
          text: `🎙️ NotebookLM Audio Overview:\n\n${aiResponse}` 
        }]);

        // Start playback and avatar presentation
        if (audioRef.current && audioRef.current.src) {
          setCurrentSpeech(aiResponse);
          setIsSpeaking(true);
          setConnectionStatus('Speaking...');
          if (videoRef.current) {
            videoRef.current.muted = true;
          }
          if (streamManagerRef.current && didInitialized.current) {
            streamManagerRef.current.talk(aiResponse).catch(err => console.warn('D-ID talk error:', err));
          }
          audioRef.current.play().catch(e => console.warn("Audio play error:", e));
        } else {
          await speakResponse(aiResponse, true);
        }
      } else {
        setChatMessages(prev => [...prev, { 
          sender: 'ai', 
          text: `📰 Article Summary:\n\n${aiResponse}` 
        }]);
        await speakResponse(aiResponse, true);
      }
    } catch (err) {
      const msg = `I'm having trouble reading this article. ${err.message || 'Please check the backend connection.'}`;
      setChatMessages(prev => [...prev, { sender: 'ai', text: msg }]);
      await speakResponse(msg, true);
    } finally {
      setIsThinking(false);
    }
  };

  // ── Daily Briefing ─────────────────────────────────────────────
  const handleReadBriefing = async () => {
    if (isThinking) return;
    setIsThinking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/news?keyword=general`);
      const articles = await response.json();
      let briefingText = 'Welcome to your Truth Lens Daily Briefing. Here are the top stories. ';
      if (articles?.length > 0) {
        articles.slice(0, 3).forEach((art, index) => {
          briefingText += `Story ${index + 1}: ${art.title}. `;
        });
        briefingText += "That concludes today's headlines. Stay informed with Truth Lens!";
      } else {
        briefingText += 'We are experiencing difficulty retrieving the live news feed. Please try again shortly.';
      }
      setChatMessages(prev => [...prev, { sender: 'ai', text: briefingText }]);
      await speakResponse(briefingText);
    } catch (err) {
      const msg = "I had trouble fetching today's briefing.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: msg }]);
      await speakResponse(msg);
    } finally {
      setIsThinking(false);
    }
  };

  const isOnline = connectionStatus !== 'Disconnected' && connectionStatus !== 'Connecting...';

  return (
    <div className="presenter-container">
      <div className="presenter-shell">
        <h1 className="presenter-title">Interactive AI News Portal</h1>

        <div className="presenter-layout">
          {/* Left panel: Avatar */}
          <div className="avatar-frame-panel">
            <div className="avatar-video-container">
              {!isSessionStarted ? (
                <div className="start-session-gateway">
                  <div className="gateway-glow"></div>
                  <div className="avatar-preview-silhouette">
                    <div className="silhouette-head"></div>
                    <div className="silhouette-body"></div>
                    <div className="silhouette-pulse-ring ring1"></div>
                    <div className="silhouette-pulse-ring ring2"></div>
                  </div>
                  <button className="gateway-btn animate-pulse" onClick={handleStartSession}>
                    <span className="gateway-icon">🎙️</span>
                    Initialize AI Presenter
                  </button>
                  <p className="gateway-subtext">Powered by ElevenLabs AI Voice · D-ID Avatar</p>
                </div>
              ) : (
                <>
                  <div className="status-bubble-overlay">
                    <span className={`status-indicator-dot ${isOnline ? 'online' : 'connecting'} ${isSpeaking ? 'speaking-dot' : ''}`}></span>
                    {connectionStatus}
                    {useDID && videoReady && <span style={{ marginLeft: 6, fontSize: 10, color: '#34d399' }}>● Live Avatar</span>}
                    {!useDID && <span style={{ marginLeft: 6, fontSize: 10, color: '#a78bfa' }}>● EL Voice</span>}
                  </div>

                  <video ref={videoRef} autoPlay playsInline muted className="did-video-player"
                    style={{ opacity: videoReady ? 1 : 0.01, position: videoReady ? 'relative' : 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: videoReady ? 10 : -1 }} />

                  {!videoReady && (
                    <div className="avatar-placeholder-image" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, backgroundImage: 'url("https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.png")', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '12px' }}>
                      <div className="status-bubble-overlay" style={{ position: 'absolute', top: '10px', left: '10px' }}>
                        <span className="status-indicator-dot connecting"></span>
                        Connecting to D-ID stream...
                      </div>
                    </div>
                  )}

                  {currentSpeech && (
                    <div className="subtitle-overlay">
                      <div className="subtitle-teleprompter">
                        <span className="teleprompter-prefix">🎙 {isSpeaking ? 'SPEAKING' : 'LIVE'}</span>
                        <p className="teleprompter-text">{currentSpeech}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {isSessionStarted && (
              <div className="presenter-controls">
                <button className="control-btn briefing-btn" onClick={handleReadBriefing}
                  disabled={isThinking || isSpeaking}>
                  📰 Read Daily Briefing
                </button>
                <button className="control-btn clear-btn" onClick={handleStopSpeaking}
                  disabled={!isSpeaking && !isListening}>
                  🔇 Stop
                </button>
              </div>
            )}

            {newsSources && (
              <div className="news-sources-panel">
                <h4 className="news-sources-title">📡 News Sources Checked</h4>
                {newsSources.sources.map((src, i) => (
                  <div key={i} className="news-source-item">
                    <span className="news-source-dot"></span>
                    <div>
                      <strong>{src.name}</strong> — <span className="news-source-site">{src.website}</span>
                      <p className="news-source-desc">{src.coverage}</p>
                    </div>
                  </div>
                ))}
                <p className="news-source-ai-note">🤖 {newsSources.ai_analysis}</p>
              </div>
            )}
          </div>

          {/* Right panel: Voice & Chat */}
          <div className="chat-dialog-panel">
            {/* Tab switcher */}
            <div className="emma-tab-switcher">
              <button
                className={`emma-tab-btn ${articleTab === 'voice' ? 'active' : ''}`}
                onClick={() => setArticleTab('voice')}>
                🎤 Voice Chat
              </button>
              <button
                className={`emma-tab-btn ${articleTab === 'article' ? 'active' : ''}`}
                onClick={() => setArticleTab('article')}>
                📄 Read Article
              </button>
            </div>

            {/* Voice Tab */}
            {articleTab === 'voice' && (
              <>
                <div className="chat-message-history">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-message ${msg.sender}`}>
                      <div className="message-header">
                        <span className="message-sender-name">{msg.sender === 'ai' ? 'Presenter Emma' : 'You'}</span>
                      </div>
                      <div className="message-bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="chat-message ai thinking">
                      <div className="message-bubble typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Voice Input Area */}
                <div className="voice-input-section">
                  {/* Live transcript display */}
                  {(isListening || voiceTranscript) && (
                    <div className="voice-transcript-box">
                      <span className="transcript-label">{isListening ? '🎤 Listening...' : '✅ Heard:'}</span>
                      <p className="transcript-text">{voiceTranscript || 'Speak now...'}</p>
                    </div>
                  )}

                  <div className="voice-controls-row">
                    {micSupported ? (
                      <button
                        className={`mic-hold-btn ${isListening ? 'listening' : ''}`}
                        onMouseDown={isSessionStarted && !isThinking && !isSpeaking ? startListening : undefined}
                        onMouseUp={isListening ? stopListening : undefined}
                        onTouchStart={isSessionStarted && !isThinking && !isSpeaking ? startListening : undefined}
                        onTouchEnd={isListening ? stopListening : undefined}
                        disabled={!isSessionStarted || isThinking || isSpeaking}
                        title="Hold to speak"
                      >
                        <span className="mic-icon">{isListening ? '🔴' : '🎤'}</span>
                        <span className="mic-label">{isListening ? 'Release to send' : 'Hold to speak'}</span>
                        {isListening && <span className="mic-pulse-ring"></span>}
                      </button>
                    ) : (
                      <div className="mic-not-supported">🚫 Microphone not supported in this browser. Use Chrome for voice input.</div>
                    )}
                  </div>

                  <p className="voice-hint">
                    {!isSessionStarted
                      ? '👆 Click "Initialize AI Presenter" first'
                      : isListening
                      ? '🎙️ Listening — release the button when done speaking'
                      : isSpeaking
                      ? '🔊 Emma is speaking — wait or click Stop'
                      : isThinking
                      ? '⏳ Processing your question...'
                      : '🎤 Hold the button and speak your question clearly'}
                  </p>
                </div>
              </>
            )}

            {/* Article Reader Tab */}
            {articleTab === 'article' && (
              <div className="article-reader-panel">
                <div className="article-reader-info">
                  <h4>📋 Article Reader</h4>
                  <p>Paste an article text or a webpage link below, and Emma will present a highly optimized audio briefing or a NotebookLM-style conversational overview!</p>
                </div>

                {/* Input Type Selector */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button 
                    onClick={() => setArticleInputType('text')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #4b5563',
                      background: articleInputType === 'text' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    📄 Paste Article Text
                  </button>
                  <button 
                    onClick={() => setArticleInputType('link')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #4b5563',
                      background: articleInputType === 'link' ? '#3b82f6' : '#1f2937',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    🔗 Paste Webpage Link
                  </button>
                </div>

                {articleInputType === 'text' ? (
                  <textarea
                    className="article-paste-area"
                    placeholder="Paste the full article text here...&#10;&#10;Emma will read a short, clear broadcast-style summary of it."
                    value={articleText}
                    onChange={e => setArticleText(e.target.value)}
                    rows={8}
                    disabled={!isSessionStarted || isThinking || isSpeaking}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#111827', color: 'white', border: '1px solid #374151', borderRadius: '8px', padding: '10px' }}
                  />
                ) : (
                  <input
                    type="url"
                    placeholder="https://example.com/news-article"
                    value={articleUrl}
                    onChange={e => setArticleUrl(e.target.value)}
                    disabled={!isSessionStarted || isThinking || isSpeaking}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#111827',
                      color: 'white',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '13px',
                      marginBottom: '15px'
                    }}
                  />
                )}

                {/* NotebookLM Mode Toggle */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px dashed #3b82f6', 
                  borderRadius: '8px', 
                  padding: '10px', 
                  marginBottom: '15px' 
                }}>
                  <input
                    type="checkbox"
                    id="notebooklm-toggle"
                    checked={useNotebookLMStyle}
                    onChange={e => setUseNotebookLMStyle(e.target.checked)}
                    disabled={!isSessionStarted || isThinking || isSpeaking}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <label htmlFor="notebooklm-toggle" style={{ color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                    🧠 Enable NotebookLM Podcast Style (Conversational Audio Monologue)
                  </label>
                </div>

                <div className="article-reader-actions">
                  <span className="article-char-count">
                    {articleInputType === 'text' ? `${articleText.length} / 1500 chars` : 'URL Input'}
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {lastAudioBlob && !isRenderingPodcast && (
                      <button
                        className="article-download-btn"
                        onClick={handleDownloadMp3}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '8px',
                          border: '1px solid #10b981',
                          background: '#059669',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        📥 Download MP3
                      </button>
                    )}
                    <button className="article-clear-btn" 
                      onClick={() => { setArticleText(''); setArticleUrl(''); }}
                      disabled={articleInputType === 'text' ? !articleText : !articleUrl}
                    >
                      ✕ Clear
                    </button>
                    <button
                      className="article-read-btn"
                      onClick={handleReadArticle}
                      disabled={articleInputType === 'text' ? (!articleText.trim() || !isSessionStarted || isThinking || isSpeaking || isRenderingPodcast) : (!articleUrl.trim() || !isSessionStarted || isThinking || isSpeaking || isRenderingPodcast)}
                    >
                      {isRenderingPodcast ? '🎙️ Rendering Podcast...' : isThinking ? '⏳ Generating Audio...' : useNotebookLMStyle ? '🎙️ Generate Podcast' : '🎙️ Present Article'}
                    </button>
                  </div>
                </div>

                {isRenderingPodcast && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    padding: '20px',
                    marginTop: '20px',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div className="search-spinner" style={{ width: '18px', height: '18px', margin: '0' }}></div>
                      Rendering Podcast Monologue...
                    </div>
                    <div style={{ fontSize: '13px', color: '#a7f3d0', marginBottom: '15px', fontWeight: 500 }}>{podcastStage}</div>
                    <div style={{
                      height: '10px',
                      width: '100%',
                      background: '#1f2937',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      position: 'relative',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${podcastProgressPercent}%`,
                        background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                        borderRadius: '5px',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>{podcastProgressPercent}% Complete</div>
                  </div>
                )}

                {/* Show conversation log below */}
                {chatMessages.length > 1 && (
                  <div className="article-chat-log">
                    <div className="article-chat-log-title">💬 Session Log</div>
                    <div className="chat-message-history" style={{ maxHeight: '200px' }}>
                      {chatMessages.slice(-4).map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.sender}`}>
                          <div className="message-bubble" style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{msg.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPresenter;
