import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DIDStreamManager } from '../utils/did-stream';
import { API_BASE_URL } from '../config';

const AiPresenter = () => {
  const videoRef = useRef(null);
  const streamManagerRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const didInitialized = useRef(false);

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
  const [articleTab, setArticleTab] = useState('voice'); // 'voice' | 'article'

  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Emma, your AI News Presenter. Click "Initialize" to start, then hold the 🎤 mic button and speak your question — or paste any article for me to read!' }
  ]);
  const [newsSources, setNewsSources] = useState(null);
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
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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

  const speakResponse = useCallback(async (text) => {
    setCurrentSpeech(text);
    setIsSpeaking(true);
    setConnectionStatus('Speaking...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('TTS failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setIsSpeaking(false); setCurrentSpeech(''); };
      await audio.play();
    } catch (err) {
      speakWithBrowserTTS(text);
    }
  }, [speakWithBrowserTTS]);

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
          if (vid && vid.srcObject && vid.readyState >= 2) {
            clearInterval(checkVideo);
            vid.muted = false;
            setVideoReady(true);
            setConnectionStatus('Connected');
          } else if (vid && vid.srcObject && vid.paused) {
            vid.play().catch(() => {});
          }
          if (attempts > 40) clearInterval(checkVideo);
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
    setIsSessionStarted(true);
    setConnectionStatus('Connecting...');
    setTimeout(async () => {
      setConnectionStatus('Emma is ready');
      await speakResponse('Hello! I am Emma, your AI News Presenter from Truth Lens. Hold the microphone button and speak your question, or paste an article for me to read aloud!');
    }, 400);
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
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setVoiceTranscript(transcript);
    };
    recognition.onend = () => {
      setIsListening(false);
      // Auto-send when speech ends
      const finalTranscript = recognitionRef.current?._finalTranscript || voiceTranscript;
      if (finalTranscript.trim()) handleSendVoiceMessage(finalTranscript.trim());
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceTranscript('');
    };
    // Store transcript for use on end
    recognition.onspeechend = () => {
      recognition._finalTranscript = voiceTranscript;
    };
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current._finalTranscript = voiceTranscript;
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
        body: JSON.stringify({ message: text })
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

  // ── Article Reader ─────────────────────────────────────────────
  const handleReadArticle = async () => {
    if (!articleText.trim() || isThinking) return;
    setIsThinking(true);
    const truncated = articleText.trim().slice(0, 1500);
    setChatMessages(prev => [...prev, {
      sender: 'user',
      text: `📄 [Article submitted for reading]\n\n${truncated.slice(0, 120)}...`
    }]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Please give me a brief, clear spoken summary of this article in 3-4 sentences, as if you are a news presenter reading it on air:\n\n${truncated}`
        })
      });
      const data = await response.json();
      const aiResponse = data.response || 'Unable to summarize the article.';
      setChatMessages(prev => [...prev, { sender: 'ai', text: `📰 Article Summary:\n\n${aiResponse}` }]);
      await speakResponse(aiResponse);
    } catch (err) {
      const msg = "I'm having trouble reading this article. Please check the backend connection.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: msg }]);
      await speakResponse(msg);
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
                    style={{ display: videoReady ? 'block' : 'none' }} />

                  {!videoReady && (
                    <div className="animated-fallback-presenter">
                      <div className="glowing-avatar-orb-outer">
                        <div className="glowing-avatar-orb-middle">
                          <div className={`glowing-avatar-orb-inner ${isSpeaking ? 'speaking' : ''}`}>
                            <span className="avatar-face-icon">{isListening ? '👂' : isSpeaking ? '🎙️' : '🤖'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="avatar-waveform-visualizer">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i}
                            className={`waveform-bar ${(isSpeaking || isListening) ? 'animating' : ''}`}
                            style={{ animationDelay: `${i * 0.04}s`, animationDuration: `${0.4 + (i % 5) * 0.08}s` }} />
                        ))}
                      </div>
                      <div className="emma-name-badge">
                        <span className={`live-dot ${(isSpeaking || isListening) ? 'live' : ''}`}></span>
                        <span className="emma-badge-name">EMMA</span>
                        <span className="emma-badge-title">
                          {isListening ? '👂 Listening...' : isSpeaking ? 'Speaking via ElevenLabs AI' : 'AI Presenter · ElevenLabs Voice'}
                        </span>
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
                  <p>Paste any news article below and Emma will briefly summarize and read it aloud like a live broadcast presenter.</p>
                </div>
                <textarea
                  className="article-paste-area"
                  placeholder="Paste the full article text here...&#10;&#10;Emma will read a short, clear broadcast-style summary of it."
                  value={articleText}
                  onChange={e => setArticleText(e.target.value)}
                  rows={10}
                  disabled={!isSessionStarted || isThinking || isSpeaking}
                />
                <div className="article-reader-actions">
                  <span className="article-char-count">{articleText.length} / 1500 chars</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="article-clear-btn" onClick={() => setArticleText('')}
                      disabled={!articleText}>✕ Clear</button>
                    <button
                      className="article-read-btn"
                      onClick={handleReadArticle}
                      disabled={!articleText.trim() || !isSessionStarted || isThinking || isSpeaking}
                    >
                      {isThinking ? '⏳ Reading...' : '🎙️ Read This Article'}
                    </button>
                  </div>
                </div>

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
