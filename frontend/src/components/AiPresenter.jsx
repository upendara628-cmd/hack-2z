import React, { useState, useEffect, useRef } from 'react';
import { DIDStreamManager } from '../utils/did-stream';
import { API_BASE_URL } from '../config';

const AiPresenter = () => {
  const videoRef = useRef(null);
  const streamManagerRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hello! I am Emma, your AI News Presenter. You can ask me to read the daily briefing or type a question to chat!' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');
  
  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamManagerRef.current) {
        streamManagerRef.current.destroy().catch(err => console.error("Clean up error:", err));
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleStartSession = async () => {
    setIsSessionStarted(true);
    setConnectionStatus('Initializing...');
    
    try {
      const manager = new DIDStreamManager(videoRef.current, (status) => {
        setConnectionStatus(status);
        if (status.includes('Failed') || status.includes('disconnected')) {
          setUseFallback(true);
        }
      });
      streamManagerRef.current = manager;
      await manager.connect();
      setUseFallback(false);
    } catch (err) {
      console.warn("D-ID streaming failed to initialize. Falling back to native browser speech synthesis.", err);
      setUseFallback(true);
      setConnectionStatus('Native TTS Fallback Active');
    }
  };

  const handleReadBriefing = async () => {
    if (isThinking) return;
    setIsThinking(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/news?keyword=general`);
      const articles = await response.json();
      
      let briefingText = "Welcome to your Meridian Daily Briefing. Here are the top stories. ";
      
      if (articles && articles.length > 0) {
        articles.slice(0, 3).forEach((art, index) => {
          briefingText += `Story ${index + 1}: ${art.title}. `;
        });
        briefingText += "That concludes today's headlines. Stay informed!";
      } else {
        briefingText += "We are currently experiencing difficulty retrieving the live news feed. Please try again shortly.";
      }
      
      speakResponse(briefingText);
    } catch (err) {
      console.error("Error reading briefing:", err);
      speakResponse("I had trouble fetching today's briefing. Please verify your internet connection.");
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
      const aiResponse = data.response || "I could not retrieve an AI reply. Please try again.";
      
      setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
      speakResponse(aiResponse);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg = "I am having trouble connecting to my cognitive backend right now.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: errorMsg }]);
      speakResponse(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const speakResponse = async (text) => {
    setCurrentSpeech(text);
    
    if (!useFallback && streamManagerRef.current && streamManagerRef.current.streamId) {
      try {
        setConnectionStatus('Speaking...');
        await streamManagerRef.current.talk(text);
        return;
      } catch (err) {
        console.warn("Talk streaming request failed, falling back to synthesis", err);
        setUseFallback(true);
      }
    }
    
    // Browser Speech Synthesis fallback
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to pick a high quality natural English voice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => 
      v.name.includes('Google') && v.lang.startsWith('en') || 
      v.name.includes('Natural') && v.lang.startsWith('en') ||
      v.lang.startsWith('en-US')
    );
    if (premiumVoice) utterance.voice = premiumVoice;
    
    utterance.onstart = () => {
      setConnectionStatus('Speaking (Native)...');
    };
    utterance.onend = () => {
      setConnectionStatus('Connected (Native)');
      setCurrentSpeech('');
    };
    utterance.onerror = () => {
      setConnectionStatus('Connected (Native)');
      setCurrentSpeech('');
    };
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="presenter-container">
      <div className="presenter-shell">
        <h1 className="presenter-title">Interactive AI News Portal</h1>
        
        <div className="presenter-layout">
          {/* Left panel: Video / Avatar Frame */}
          <div className="avatar-frame-panel">
            <div className="avatar-video-container">
              {!isSessionStarted ? (
                <div className="start-session-gateway">
                  <div className="gateway-glow"></div>
                  <button className="gateway-btn animate-pulse" onClick={handleStartSession}>
                    <span className="gateway-icon">🎙️</span>
                    Initialize AI Presenter Session
                  </button>
                  <p className="gateway-subtext">Establishing secure low-latency WebRTC connection</p>
                </div>
              ) : (
                <>
                  {/* Status Indicator */}
                  <div className="status-bubble-overlay">
                    <span className={`status-indicator-dot ${connectionStatus === 'Connected' || connectionStatus.includes('Active') || connectionStatus.includes('Speaking') ? 'online' : 'connecting'}`}></span>
                    {connectionStatus}
                  </div>
                  
                  {/* D-ID WebRTC Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="did-video-player"
                    style={{ display: useFallback ? 'none' : 'block' }}
                  />
                  
                  {/* Fallback Animated 3D Orb/Presenter Interface */}
                  {useFallback && (
                    <div className="animated-fallback-presenter">
                      <div className="glowing-avatar-orb-outer">
                        <div className="glowing-avatar-orb-middle">
                          <div className={`glowing-avatar-orb-inner ${connectionStatus.includes('Speaking') ? 'speaking' : ''}`}>
                            <span className="avatar-face-icon">👤</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Audio visualizer waves */}
                      <div className="avatar-waveform-visualizer">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`waveform-bar ${connectionStatus.includes('Speaking') ? 'animating' : ''}`}
                            style={{ 
                              animationDelay: `${i * 0.05}s`,
                              height: connectionStatus.includes('Speaking') ? undefined : '4px'
                            }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtitle Teleprompter overlay */}
                  {currentSpeech && (
                    <div className="subtitle-overlay">
                      <div className="subtitle-teleprompter">
                        <span className="teleprompter-prefix">LIVE TELEPROMPTER:</span>
                        <p className="teleprompter-text">{currentSpeech}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Quick Actions Panel */}
            {isSessionStarted && (
              <div className="presenter-controls">
                <button className="control-btn briefing-btn" onClick={handleReadBriefing} disabled={isThinking}>
                  📰 Read Daily News Briefing
                </button>
                <button className="control-btn clear-btn" onClick={() => window.speechSynthesis.cancel()}>
                  🔇 Stop Speaking
                </button>
              </div>
            )}
          </div>
          
          {/* Right panel: Chat / Dialog Log */}
          <div className="chat-dialog-panel">
            <h3 className="dialog-title">Conversation Log</h3>
            <div className="chat-message-history">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.sender}`}>
                  <div className="message-header">
                    <span className="message-sender-name">{msg.sender === 'ai' ? 'Presenter Emma' : 'You'}</span>
                  </div>
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="chat-message ai thinking">
                  <div className="message-bubble typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="chat-input-row">
              <input
                type="text"
                className="presenter-chat-input"
                placeholder="Ask a question about today's politics or science..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={!isSessionStarted || isThinking}
              />
              <button 
                type="submit" 
                className="presenter-chat-send" 
                disabled={!isSessionStarted || isThinking || !chatInput.trim()}
              >
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
