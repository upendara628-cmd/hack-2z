import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const BiasAnalysis = ({ biasTone, biasAnalysis }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!biasTone) return null;
  
  const getBadgeClass = (tone) => {
    const t = tone.toLowerCase();
    if (t.includes('left')) return 'left-leaning';
    if (t.includes('right')) return 'right-leaning';
    return 'neutral';
  };
  
  return (
    <div className="bias-container">
      <div className="bias-header-row">
        <span className={`bias-badge ${getBadgeClass(biasTone)}`}>
          ⚖️ {biasTone}
        </span>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
          className="bias-analysis-toggle"
        >
          {isOpen ? 'Hide AI Analysis ▲' : 'Show AI Analysis ▼'}
        </button>
      </div>
      {isOpen && (
        <div className="bias-analysis-content">
          <h5>AI Bias & Fact Omission Report</h5>
          <ul className="bias-analysis-list">
            {biasAnalysis && biasAnalysis.map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const FeaturedArticle = () => {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    fetch(`${API_BASE_URL}/api/news?keyword=world`)
      .then(res => res.json())
      .then(data => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 1200 - elapsed);
        setTimeout(() => {
          if (data && data.length > 0) {
            setArticle(data[0]);
          }
          setLoading(false);
        }, delay);
      })
      .catch(err => {
        console.error('Error fetching featured article:', err);
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 1200 - elapsed);
        setTimeout(() => {
          setLoading(false);
        }, delay);
      });
  }, []);

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

  const handleSpeakClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (speaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeaking(true);
      
      const targetArticle = article || currentArticle;
      const cleanDesc = targetArticle.description ? targetArticle.description.replace(/<[^>]*>/g, '') : '';
      const textToSpeak = `${targetArticle.title}. ${cleanDesc}`;

      try {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak })
        });
        
        if (!response.ok) throw new Error('ElevenLabs TTS failed');
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } catch (err) {
        console.warn('ElevenLabs TTS failed, falling back to browser SpeechSynthesis:', err);
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const voices = window.speechSynthesis.getVoices();
        const premiumVoice = voices.find(v => 
          v.name.includes('Google') && v.lang.startsWith('en') || 
          v.name.includes('Natural') && v.lang.startsWith('en') ||
          v.lang.startsWith('en-US')
        );
        if (premiumVoice) utterance.voice = premiumVoice;

        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  if (loading) {
    return (
      <section className="featured-section">
        <div className="featured-article" style={{ padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px' }}>
          <div className="skeleton-image" style={{ height: '350px' }}></div>
          <div className="skeleton-title" style={{ marginTop: '20px', height: '24px' }}></div>
          <div className="skeleton-text" style={{ marginTop: '10px', width: '60%' }}></div>
        </div>
      </section>
    );
  }

  // Fallback to static copy if fetch failed or returned nothing
  const currentArticle = article || {
    image: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=500&fit=crop",
    category: "WORLD",
    title: "Germany's Last Coal Plant Closes, Completing a Decade-Long Energy Transition",
    description: "The historic shutdown marks the end of an era for Europe's largest economy, which has spent billions shifting to renewable energy sources.",
    author: "Elena Schwarz",
    time: "1 hour ago",
    url: "#",
    bias_tone: "Neutral",
    bias_analysis: [
      "Highlights the successful construction of renewable projects over the last decade.",
      "Provides comments from both utility companies and climate activist groups.",
      "Identifies remaining grid storage challenges objectively."
    ]
  };

  return (
    <section className="featured-section">
      <a href={currentArticle.url} target="_blank" rel="noopener noreferrer" className="featured-article-link" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={`featured-article ${speaking ? 'article-card-speaking-highlight' : ''}`}>
          <div className="featured-image">
            <img 
              src={currentArticle.image} 
              alt={currentArticle.title} 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=400&fit=crop";
              }}
            />
          </div>
          <div className="featured-content">
            <span className="category">{currentArticle.category || 'WORLD'}</span>
            <h1 className="featured-title">{currentArticle.title}</h1>
            <p className="featured-excerpt">{currentArticle.description}</p>
            <div className="article-meta">
              <span className="author">{currentArticle.author}</span>
              <span className="time">{currentArticle.time}</span>
            </div>
            
            <div className="speak-article-badge-row">
              <BiasAnalysis 
                biasTone={currentArticle.bias_tone} 
                biasAnalysis={currentArticle.bias_analysis} 
              />
              <button 
                className={`article-speak-btn ${speaking ? 'active-speaking' : ''}`}
                onClick={handleSpeakClick}
              >
                {speaking ? '⏹️ Stop' : '🔊 Listen'}
              </button>
            </div>
          </div>
        </div>
      </a>
    </section>
  );
};

export default FeaturedArticle;
