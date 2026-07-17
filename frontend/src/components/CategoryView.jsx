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
          {isOpen ? 'Hide AI ▲' : 'Show AI ▼'}
        </button>
      </div>
      
      {isOpen && (
        <ul className="bias-bullets" onClick={(e) => e.stopPropagation()}>
          {biasAnalysis && biasAnalysis.map((bullet, idx) => (
            <li key={idx} className="bias-bullet-item">
              <span className="bullet-point">•</span>
              <span className="bullet-text">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CategoryView = ({ category, onBack }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [biasStats, setBiasStats] = useState({ left: 0, right: 0, neutral: 0 });
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    const fetchCategoryNews = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/news?keyword=${category.toLowerCase()}`);
        const data = await response.json();
        setArticles(data || []);
        calculateBiasStats(data || []);
      } catch (err) {
        console.error(`Error fetching category ${category} news:`, err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategoryNews();
  }, [category]);

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

  const handleSpeak = async (e, article) => {
    e.preventDefault();
    e.stopPropagation();

    const id = article.id || article.title;
    if (speakingId === id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setSpeakingId(id);
      
      const cleanDesc = article.description ? article.description.replace(/<[^>]*>/g, '') : '';
      const textToSpeak = `${article.title}. ${cleanDesc}`;

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
          setSpeakingId(null);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setSpeakingId(null);
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

        utterance.onend = () => setSpeakingId(null);
        utterance.onerror = () => setSpeakingId(null);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const calculateBiasStats = (articleList) => {
    if (articleList.length === 0) return;
    let left = 0, right = 0, neutral = 0;
    articleList.forEach(art => {
      const tone = art.bias_tone?.toLowerCase() || 'neutral';
      if (tone.includes('left')) left++;
      else if (tone.includes('right')) right++;
      else neutral++;
    });
    const total = articleList.length;
    setBiasStats({
      left: Math.round((left / total) * 100),
      right: Math.round((right / total) * 100),
      neutral: Math.round((neutral / total) * 100)
    });
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="dashboard-title-header" style={{ margin: 0 }}>
          {category.toUpperCase()} HUB
        </h1>
        <button 
          onClick={onBack}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c41e3a'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#1a1a1a'}
        >
          ← Back to Home
        </button>
      </div>

      {articles.length > 0 && (
        <div className="chart-panel" style={{ marginBottom: '40px' }}>
          <h2 className="panel-title">📊 Media Bias Split inside {category} news</h2>
          
          <div className="chart-container-visual">
            {/* Left Leaning Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Left-Leaning</span>
                <span>{biasStats.left}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill left-leaning" style={{ width: `${biasStats.left}%` }}></div>
              </div>
            </div>

            {/* Neutral Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Neutral / Balanced</span>
                <span>{biasStats.neutral}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill neutral" style={{ width: `${biasStats.neutral}%` }}></div>
              </div>
            </div>

            {/* Right Leaning Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Right-Leaning</span>
                <span>{biasStats.right}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill right-leaning" style={{ width: `${biasStats.right}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Articles Feed */}
      <div className="dashboard-articles-section">
        <h2 className="dashboard-articles-title">📰 Real-Time Feed</h2>
        
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
            <div className="skeleton-animation" style={{ height: '100px', marginBottom: '15px', borderRadius: '8px' }}></div>
            <div className="skeleton-animation" style={{ height: '100px', marginBottom: '15px', borderRadius: '8px' }}></div>
            <p>Fetching real-time coverage and auditing political tone bias...</p>
          </div>
        ) : articles.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
            No recent articles found for this category. Please check back later.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {articles.map((article, idx) => {
              const currentId = article.id || article.title;
              const isSpeaking = speakingId === currentId;
              
              return (
                <div 
                  key={idx}
                  className={isSpeaking ? 'article-card-speaking-highlight' : ''}
                  style={{
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'row',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Image */}
                  <div style={{ width: '180px', height: '140px', flexShrink: 0 }}>
                    <img 
                      src={article.image} 
                      alt={article.title} 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=250&fit=crop";
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  
                  {/* Content */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="source-badge">{article.source || 'CurrentsAPI'}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>{article.time || 'Recent'}</span>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>
                      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                        {article.title}
                      </a>
                    </h3>
                    <p style={{ fontSize: '14px', color: '#444', margin: 0, lineBreak: 'anywhere' }}>
                      {article.description}
                    </p>
                    
                    <div className="speak-article-badge-row" style={{ marginTop: '8px', border: 'none', paddingTop: 0 }}>
                      <BiasAnalysis 
                        biasTone={article.bias_tone} 
                        biasAnalysis={article.bias_analysis} 
                      />
                      <button 
                        className={`article-speak-btn ${isSpeaking ? 'active-speaking' : ''}`}
                        onClick={(e) => handleSpeak(e, article)}
                      >
                        {isSpeaking ? '⏹️ Stop' : '🔊 Listen'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryView;
