import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { Room, RoomEvent } from 'livekit-client';

const PersonalAssistant = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am **Nexus**, your personal AI assistant. I can help you analyze news stories, draft reports, dissect political bias, or answer any general questions. \n\nHow can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('Disconnected');
  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const roomRef = useRef(null);

  const suggestedPrompts = [
    { label: '📰 Summarize Tech News', prompt: "Draft a briefing summarizing the top technology and semiconductor news from today." },
    { label: '⚖️ Analyze Politics Bias', prompt: "How do Left-Leaning and Right-Leaning sources typically frame border policy debates differently?" },
    { label: '📈 Trending Topics', prompt: "What are the current trending topics globally, and why are they drawing attention?" },
    { label: '✍️ Draft Social Post', prompt: "Write a professional LinkedIn post summarizing recent developments in international environmental policy." }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleDisconnectCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsInCall(false);
    setCallStatus('Disconnected');
  };

  const handleStartCall = async () => {
    setCallStatus('Requesting token...');
    setIsInCall(true);
    
    // Stop ElevenLabs chat narration if active
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: `nexus-room-${Math.random().toString(36).substring(7)}`,
          participantName: `user-${Math.random().toString(36).substring(7)}`
        })
      });
      
      if (!res.ok) throw new Error('Failed to get token');
      const { token, serverUrl } = await res.json();
      
      setCallStatus('Connecting to LiveKit...');
      const room = new Room();
      roomRef.current = room;
      
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'audio') {
          const el = track.attach();
          el.play().catch(e => console.warn("Autoplay audio failed:", e));
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsInCall(false);
        setCallStatus('Disconnected');
        roomRef.current = null;
      });

      await room.connect(serverUrl, token);
      setCallStatus('Connecting audio...');
      
      await room.localParticipant.setMicrophoneEnabled(true);
      setCallStatus('Connected');
    } catch (err) {
      console.error('LiveKit connection failed:', err);
      setCallStatus(`Error: ${err.message}`);
      setIsInCall(false);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    }
  };

  const speakResponse = async (text) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    // Strip markdown formatting for cleaner speech synthesis
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1');

    setIsSpeaking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText })
      });

      if (!response.ok) throw new Error('ElevenLabs TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.warn('ElevenLabs TTS failed, falling back to browser SpeechSynthesis:', err);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find(v => 
        v.name.includes('Google') && v.lang.startsWith('en') || 
        v.name.includes('Natural') && v.lang.startsWith('en') ||
        v.lang.startsWith('en-US')
      );
      if (premiumVoice) utterance.voice = premiumVoice;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    // Add user message to state
    const newMessages = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setInput('');
    setIsThinking(true);

    // Stop speaking user input
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    try {
      // Prepare history to send (last 10 messages to avoid large tokens)
      const historyToSend = messages
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE_URL}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyToSend
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const aiResponse = data.response || 'No response received.';
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      
      if (!isMuted) {
        speakResponse(aiResponse);
      }
    } catch (error) {
      console.error('Error fetching assistant response:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Sorry, I encountered an error communicating with the backend. Please check if the Flask server is running.' }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Simple Markdown formatter to keep dependencies light and robust
  const formatMessageContent = (text) => {
    if (!text) return { __html: '' };

    // Escape basic HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks: ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="markdown-code-block"><code>$1</code></pre>');

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Bullet points (ensure we capture multi-line lists properly)
    let lines = html.split('\n');
    let insideList = false;
    let listFormattedLines = lines.map(line => {
      const bulletMatch = line.match(/^\s*[-*+]\s+(.*)$/);
      if (bulletMatch) {
        let content = bulletMatch[1];
        if (!insideList) {
          insideList = true;
          return '<ul><li>' + content + '</li>';
        }
        return '<li>' + content + '</li>';
      } else {
        if (insideList) {
          insideList = false;
          return '</ul>' + line;
        }
        return line;
      }
    });
    if (insideList) {
      listFormattedLines.push('</ul>');
    }
    html = listFormattedLines.join('\n');

    // Paragraph splits
    html = html.split('\n\n').map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<ul') || trimmed.startsWith('<pre') || trimmed.startsWith('<li') || trimmed.endsWith('</ul>')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br />')}</p>`;
    }).join('');

    return { __html: html };
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation history cleared. Ready for your next query! How can I assist you?'
      }
    ]);
  };

  return (
    <div className="assistant-page-wrapper">
      <div className="assistant-container">
        
        {/* Left Side: Chat dialog */}
        <div className="assistant-chat-panel">
          <div className="assistant-panel-header">
            <div className="assistant-title-group">
              <span className="assistant-logo-dot"></span>
              <h3>NEXUS AI</h3>
              <span className="assistant-version-badge">v3.5</span>
              {isSpeaking && <span className="assistant-speaking-indicator" style={{ marginLeft: '10px', fontSize: '11px', color: '#34d399', fontWeight: 600 }}>🔊 Speaking...</span>}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="assistant-clear-btn" 
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                  }
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                style={{
                  background: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                  borderColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                  color: isMuted ? '#f87171' : '#34d399'
                }}
                title={isMuted ? "Unmute voice response" : "Mute voice response"}
              >
                {isMuted ? '🔇 Muted' : '🔊 Voice: On'}
              </button>
              <button className="assistant-clear-btn" onClick={handleClearChat} title="Clear conversation">
                🗑️ Clear Chat
              </button>
            </div>
          </div>

          <div className="assistant-message-history">
            {messages.map((msg, i) => (
              <div key={i} className={`assistant-message-row ${msg.role}`}>
                <div className="assistant-avatar-circle">
                  {msg.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className="assistant-message-bubble-wrapper">
                  <div className="assistant-message-meta">
                    {msg.role === 'assistant' ? 'Nexus Assistant' : 'You'}
                  </div>
                  <div 
                    className="assistant-message-bubble" 
                    dangerouslySetInnerHTML={formatMessageContent(msg.content)}
                  />
                </div>
              </div>
            ))}
            
            {isThinking && (
              <div className="assistant-message-row assistant thinking">
                <div className="assistant-avatar-circle">🤖</div>
                <div className="assistant-message-bubble-wrapper">
                  <div className="assistant-message-meta">Nexus thinking...</div>
                  <div className="assistant-message-bubble assistant-typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions if there are only initial assistant messages */}
          {messages.length <= 2 && !isThinking && (
            <div className="assistant-suggestions-section">
              <span className="suggestions-headline">Suggested topics to explore:</span>
              <div className="assistant-suggestions-grid">
                {suggestedPrompts.map((p, i) => (
                  <button 
                    key={i} 
                    className="suggestion-chip-btn"
                    onClick={() => handleSendMessage(p.prompt)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <div className="assistant-input-container">
            <textarea
              className="assistant-textarea"
              placeholder="Ask Nexus anything... (e.g. summarize politics news, draft email, translate, explain bias)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={2}
              disabled={isThinking}
            />
            <button 
              className="assistant-send-btn" 
              onClick={() => handleSendMessage()}
              disabled={isThinking || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Right Side: Glowing Neural Visualizer */}
        <div className="assistant-visualizer-panel">
          <div className="visualizer-orb-container">
            <div className={`neural-orb-outer ${isThinking ? 'thinking' : ''} ${isInCall ? 'calling' : ''}`} style={{
              animation: isInCall ? 'speakingPulse 1.5s infinite alternate' : undefined
            }}>
              <div className="neural-orb-middle">
                <div className="neural-orb-inner">
                  <div className="neural-core"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="visualizer-info-card">
            <h4>Nexus AI Assistant</h4>
            <p className="visualizer-status-text" style={{ color: isInCall ? '#10b981' : undefined }}>
              {isInCall ? `Voice Call: ${callStatus}` : (isThinking ? 'Analyzing query and streaming tokens...' : 'Systems Online · Standing By')}
            </p>
            
            <button 
              onClick={isInCall ? handleDisconnectCall : handleStartCall}
              style={{
                background: isInCall ? '#ef4444' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                marginTop: '5px',
                marginBottom: '15px',
                boxShadow: isInCall ? '0 4px 15px rgba(239, 68, 68, 0.3)' : '0 4px 15px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isInCall ? '🛑 Disconnect Call' : '🎙️ Call Voice Agent'}
            </button>

            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <span>Bias & Framing Analysis</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎙️</span>
                <span>Real-time Voice Calls (LiveKit)</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🧠</span>
                <span>Context-Aware History</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PersonalAssistant;
