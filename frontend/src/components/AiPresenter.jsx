import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DIDStreamManager } from '../utils/did-stream';
import { API_BASE_URL } from '../config';

const AiPresenter = () => {
  const videoRef = useRef(null);
  const streamManagerRef = useRef(null);
  const audioRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [useElevenLabs, setUseElevenLabs] = useState(true);  // Prefer ElevenLabs
  const [useDID, setUseDID] = useState(false);               // D-ID status
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const didInitialized = useRef(false);  // prevent double-init in StrictMode

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Emma, your AI News Presenter. Click "Initialize" to start the session!' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [newsSources, setNewsSources] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  useEffect(() => {
    // Fetch which news websites we check
    fetch(`${API_BASE_URL}/api/news/sources`)
      .then(r => r.json())
      .then(data => setNewsSources(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (streamManagerRef.current) streamManagerRef.current.destroy().catch(() => {});
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── ElevenLabs TTS ────────────────────────────────────────────
  const speakWithElevenLabs = useCallback(async (text) => {
    setCurrentSpeech(text);
    setIsSpeaking(true);
    setConnectionStatus('Speaking...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentSpeech('');
        setConnectionStatus(useDID ? 'Connected' : 'Emma is ready');
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setCurrentSpeech('');
        setConnectionStatus('Emma is ready');
      };

      await audio.play();
    } catch (err) {
      console.warn('[ElevenLabs] Failed, falling back to browser TTS:', err);
      speakWithBrowserTTS(text);
    }
  }, [useDID]);

  // ── Browser TTS fallback ───────────────────────────────────────
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
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.onstart = () => { setIsSpeaking(true); setConnectionStatus('Speaking (TTS)...'); };
      utterance.onend = () => { setIsSpeaking(false); setCurrentSpeech(''); setConnectionStatus('Emma is ready'); };
      utterance.onerror = () => { setIsSpeaking(false); setCurrentSpeech(''); };
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) doSpeak();
    else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
  }, []);

  // ── Main speak function ────────────────────────────────────────
  const speakResponse = useCallback(async (text) => {
    if (useElevenLabs) {
      await speakWithElevenLabs(text);
    } else {
      speakWithBrowserTTS(text);
    }
  }, [useElevenLabs, speakWithElevenLabs, speakWithBrowserTTS]);

  // ── D-ID init via useEffect so video element is rendered first ──
  useEffect(() => {
    if (!isSessionStarted) return;
    if (didInitialized.current) return;
    didInitialized.current = true;

    const initDID = async () => {
      // videoRef.current is now guaranteed to be set
      if (!videoRef.current) {
        console.warn('[D-ID] video element not found after render');
        return;
      }
      console.log('[D-ID] Starting — videoRef.current:', videoRef.current);

      try {
        const manager = new DIDStreamManager(
          videoRef.current,
          (status) => {
            setConnectionStatus(status);
            if (status === 'Connected' || status === 'Waiting for avatar...') {
              setUseDID(true);
            }
          }
        );
        streamManagerRef.current = manager;
        await manager.connect();
        setUseDID(true);
        console.log('[D-ID] Stream connected — polling for video readiness');

        let attempts = 0;
        const checkVideo = setInterval(() => {
          const vid = videoRef.current;
          attempts++;
          if (vid) {
            console.log(`[D-ID poll #${attempts}] srcObject=${!!vid.srcObject} readyState=${vid.readyState} paused=${vid.paused}`);
            if (vid.srcObject && vid.readyState >= 2) {
              clearInterval(checkVideo);
              console.log('[D-ID] ✅ Video ready! Showing avatar');
              vid.muted = false;
              setVideoReady(true);
              setConnectionStatus('Connected');
            } else if (vid.srcObject && vid.paused) {
              vid.play().catch(e => console.warn('[D-ID] Force play:', e));
            }
          }
          if (attempts > 40) {
            clearInterval(checkVideo);
            console.warn('[D-ID] Video not ready after 12s. readyState:', videoRef.current?.readyState);
          }
        }, 300);

        // Trigger avatar talk after WebRTC stabilizes
        setTimeout(async () => {
          try {
            await manager.talk('Hello! I am Emma, your AI News Presenter from The Meridian.');
            console.log('[D-ID] Avatar talk triggered');
          } catch (e) {
            console.warn('[D-ID] Initial talk failed:', e.message);
          }
        }, 2000);

      } catch (err) {
        console.warn('[D-ID] Avatar not available:', err.message);
        setUseDID(false);
        setVideoReady(false);
      }
    };

    initDID();
  }, [isSessionStarted]);

  // ── Initialize session ─────────────────────────────────────────
  const handleStartSession = async () => {
    setIsSessionStarted(true);       // triggers re-render → video element mounts
    setConnectionStatus('Connecting...');
    // D-ID starts in the useEffect above, after React renders the <video>

    // ElevenLabs voice works immediately — no D-ID dependency
    setTimeout(async () => {
      setConnectionStatus('Emma is ready');
      await speakWithElevenLabs('Hello! I am Emma, your AI News Presenter from The Meridian. You can ask me to read the daily briefing or type any question to chat!');
    }, 400);
  };

  const handleStopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeech('');
    setConnectionStatus(useDID ? 'Connected' : 'Emma is ready');
  };

  const handleReadBriefing = async () => {
    if (isThinking) return;
    setIsThinking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/news?keyword=general`);
      const articles = await response.json();
      let briefingText = 'Welcome to your Meridian Daily Briefing. Here are the top stories. ';
      if (articles?.length > 0) {
        articles.slice(0, 3).forEach((art, index) => {
          briefingText += `Story ${index + 1}: ${art.title}. `;
        });
        briefingText += "That concludes today's headlines. Stay informed with The Meridian!";
      } else {
        briefingText += 'We are experiencing difficulty retrieving the live news feed. Please try again shortly.';
      }
      setChatMessages(prev => [...prev, { sender: 'ai', text: briefingText }]);
      await speakResponse(briefingText);
    } catch (err) {
      const msg = "I had trouble fetching today's briefing. Please check your connection.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: msg }]);
      await speakResponse(msg);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isThinking) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setIsThinking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await response.json();
      const aiResponse = data.response || 'I could not retrieve a reply. Please try again.';
      setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
      await speakResponse(aiResponse);
    } catch (err) {
      const errorMsg = "I'm having trouble connecting right now.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: errorMsg }]);
      await speakResponse(errorMsg);
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
                  {/* Status bar */}
                  <div className="status-bubble-overlay">
                    <span className={`status-indicator-dot ${isOnline ? 'online' : 'connecting'} ${isSpeaking ? 'speaking-dot' : ''}`}></span>
                    {connectionStatus}
                    {useDID && videoReady && <span style={{ marginLeft: 6, fontSize: 10, color: '#34d399' }}>● Live Avatar</span>}
                    {useElevenLabs && <span style={{ marginLeft: 6, fontSize: 10, color: '#a78bfa' }}>● EL Voice</span>}
                  </div>

                  {/* D-ID video — always rendered, visibility toggled by videoReady */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="did-video-player"
                    style={{ display: videoReady ? 'block' : 'none' }}
                  />

                  {/* Fallback orb when D-ID not connected */}
                  {!videoReady && (
                    <div className="animated-fallback-presenter">
                      <div className="glowing-avatar-orb-outer">
                        <div className="glowing-avatar-orb-middle">
                          <div className={`glowing-avatar-orb-inner ${isSpeaking ? 'speaking' : ''}`}>
                            <span className="avatar-face-icon">🎙️</span>
                          </div>
                        </div>
                      </div>
                      <div className="avatar-waveform-visualizer">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className={`waveform-bar ${isSpeaking ? 'animating' : ''}`}
                            style={{ animationDelay: `${i * 0.04}s`, animationDuration: `${0.4 + (i % 5) * 0.08}s` }}
                          />
                        ))}
                      </div>
                      <div className="emma-name-badge">
                        <span className={`live-dot ${isSpeaking ? 'live' : ''}`}></span>
                        <span className="emma-badge-name">EMMA</span>
                        <span className="emma-badge-title">
                          {isSpeaking ? 'Speaking via ElevenLabs AI' : 'AI Presenter · ElevenLabs Voice'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Subtitle */}
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

            {/* Controls */}
            {isSessionStarted && (
              <div className="presenter-controls">
                <button className="control-btn briefing-btn" onClick={handleReadBriefing}
                  disabled={isThinking || isSpeaking}>
                  📰 Read Daily Briefing
                </button>
                <button className="control-btn clear-btn" onClick={handleStopSpeaking}
                  disabled={!isSpeaking}>
                  🔇 Stop Speaking
                </button>
              </div>
            )}

            {/* News Sources Info */}
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

          {/* Right panel: Chat */}
          <div className="chat-dialog-panel">
            <h3 className="dialog-title">Conversation Log</h3>
            <div className="chat-message-history">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.sender}`}>
                  <div className="message-header">
                    <span className="message-sender-name">{msg.sender === 'ai' ? 'Presenter Emma' : 'You'}</span>
                  </div>
                  <div className="message-bubble">{msg.text}</div>
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

            <form onSubmit={handleSendMessage} className="chat-input-row">
              <input
                type="text"
                className="presenter-chat-input"
                placeholder="Ask a question about today's news..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={!isSessionStarted || isThinking}
              />
              <button type="submit" className="presenter-chat-send"
                disabled={!isSessionStarted || isThinking || !chatInput.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPresenter;
