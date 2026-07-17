import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const Sidebar = ({ onCategorySelect }) => {
  const [speakingSection, setSpeakingSection] = useState(null);

  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = async (e, section, title) => {
    e.preventDefault();
    e.stopPropagation();

    if (speakingSection === section) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeakingSection(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeakingSection(section);

      try {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: title })
        });
        
        if (!response.ok) throw new Error('ElevenLabs TTS failed');
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setSpeakingSection(null);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setSpeakingSection(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } catch (err) {
        console.warn('ElevenLabs TTS failed, falling back to browser SpeechSynthesis:', err);
        const utterance = new SpeechSynthesisUtterance(title);
        const voices = window.speechSynthesis.getVoices();
        const premiumVoice = voices.find(v => 
          v.name.includes('Google') && v.lang.startsWith('en') || 
          v.name.includes('Natural') && v.lang.startsWith('en') ||
          v.lang.startsWith('en-US')
        );
        if (premiumVoice) utterance.voice = premiumVoice;

        utterance.onend = () => setSpeakingSection(null);
        utterance.onerror = () => setSpeakingSection(null);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>POLITICS</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('politics'); }}>ALL POLITICS →</a>
        </div>
        <article className={`sidebar-article ${speakingSection === 'politics' ? 'article-card-speaking-highlight' : ''}`}>
          <span className="category-tag">POLITICS</span>
          <h4 className="sidebar-title">India-China Border Talks Resume After Two-Year Impasse</h4>
          <div className="article-meta">
            <span className="author">Arjun Kapoor</span>
            <span className="time">3 hours ago</span>
          </div>
          <div className="speak-article-badge-row" style={{ marginTop: '10px' }}>
            <span></span>
            <button 
              className={`article-speak-btn ${speakingSection === 'politics' ? 'active-speaking' : ''}`}
              onClick={(e) => handleSpeak(e, 'politics', "India-China Border Talks Resume After Two-Year Impasse")}
            >
              {speakingSection === 'politics' ? '⏹️ Stop' : '🔊 Listen'}
            </button>
          </div>
        </article>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>TECHNOLOGY</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('technology'); }}>ALL TECHNOLOGY →</a>
        </div>
        <article className={`sidebar-article ${speakingSection === 'tech' ? 'article-card-speaking-highlight' : ''}`}>
          <span className="category-tag">TECHNOLOGY</span>
          <h4 className="sidebar-title">Nvidia's Next Datacenter Chip Will Consume More Power Than a Small Town</h4>
          <div className="article-meta">
            <span className="author">Sofia Bertrand</span>
            <span className="time">2 hours ago</span>
          </div>
          <div className="speak-article-badge-row" style={{ marginTop: '10px' }}>
            <span></span>
            <button 
              className={`article-speak-btn ${speakingSection === 'tech' ? 'active-speaking' : ''}`}
              onClick={(e) => handleSpeak(e, 'tech', "Nvidia's Next Datacenter Chip Will Consume More Power Than a Small Town")}
            >
              {speakingSection === 'tech' ? '⏹️ Stop' : '🔊 Listen'}
            </button>
          </div>
        </article>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>BUSINESS</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('business'); }}>ALL BUSINESS →</a>
        </div>
        <article className={`sidebar-article ${speakingSection === 'business' ? 'article-card-speaking-highlight' : ''}`}>
          <span className="category-tag">BUSINESS</span>
          <h4 className="sidebar-title">Brazil's Amazon Deforestation Rate Drops 68% Under New Policies</h4>
          <div className="article-meta">
            <span className="author">Clara Ribeiro</span>
            <span className="time">5 hours ago</span>
          </div>
          <div className="speak-article-badge-row" style={{ marginTop: '10px' }}>
            <span></span>
            <button 
              className={`article-speak-btn ${speakingSection === 'business' ? 'active-speaking' : ''}`}
              onClick={(e) => handleSpeak(e, 'business', "Brazil's Amazon Deforestation Rate Drops 68% Under New Policies")}
            >
              {speakingSection === 'business' ? '⏹️ Stop' : '🔊 Listen'}
            </button>
          </div>
        </article>
      </div>
    </aside>
  );
};

export default Sidebar;
