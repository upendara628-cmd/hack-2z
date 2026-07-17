import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const BiasAnalysis = ({ biasTone, biasAnalysis }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getBadgeStyle = (tone) => {
    switch (tone) {
      case 'Left-Leaning':
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      case 'Right-Leaning':
        return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      default:
        return { background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.2)' };
    }
  };

  return (
    <div className="bias-badge-container">
      <span className="bias-badge" style={getBadgeStyle(biasTone)}>
        {biasTone}
      </span>
      <button 
        className="bias-details-toggle" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
      >
        {isOpen ? '✕ Close' : '🔍 Analyze Bias'}
      </button>
      {isOpen && (
        <div className="bias-details-drawer" onClick={(e) => e.stopPropagation()}>
          <h5>Political Bias & Framing Analysis</h5>
          <ul>
            {biasAnalysis.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const LocalNewsSection = () => {
  const [location, setLocation] = useState('Hyderabad');
  const [searchLocation, setSearchLocation] = useState('Hyderabad');
  const [language, setLanguage] = useState('telugu');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  
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

  const fetchLocalNews = () => {
    setLoading(true);
    setArticles([]);
    fetch(`${API_BASE_URL}/api/local-news?location=${encodeURIComponent(searchLocation)}&language=${language}`)
      .then(res => res.json())
      .then(data => {
        setArticles(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching local news:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLocalNews();
  }, [searchLocation, language]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (location.trim()) {
      setSearchLocation(location.trim());
    }
  };

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

  // Calculate local bias stats
  const getBiasStats = () => {
    if (!articles || articles.length === 0) return { left: 0, right: 0, neutral: 0, total: 0, dominant: 'Neutral', ratio: 0 };
    
    let left = 0, right = 0, neutral = 0;
    let analyzedCount = 0;

    articles.forEach(art => {
      if (art.bias_analysis && art.bias_analysis[0] !== 'Analyzing political framing...') {
        analyzedCount++;
        const tone = art.bias_tone || 'Neutral';
        if (tone === 'Left-Leaning') left++;
        else if (tone === 'Right-Leaning') right++;
        else neutral++;
      }
    });

    if (analyzedCount === 0) return { left: 0, right: 0, neutral: 100, total: 0, dominant: 'Neutral', ratio: 0 };

    const total = analyzedCount;
    let dominant = 'Neutral';
    let ratio = 0;

    if (left > right && left > neutral) {
      dominant = 'Left-Leaning';
      ratio = Math.round((left / total) * 100);
    } else if (right > left && right > neutral) {
      dominant = 'Right-Leaning';
      ratio = Math.round((right / total) * 100);
    } else {
      dominant = 'Neutral';
      ratio = Math.round((neutral / total) * 100);
    }

    return { left, right, neutral, total, dominant, ratio };
  };

  const biasStats = getBiasStats();

  return (
    <div className="local-news-section">
      <div className="local-news-header-panel">
        <div className="local-controls-card">
          <h2>📍 Local News Hub</h2>
          <p className="local-desc">Fetch localized regional coverage with AI bias mapping and ElevenLabs narration.</p>
          
          <form className="local-location-form" onSubmit={handleSearchSubmit}>
            <div className="local-input-group">
              <input 
                type="text" 
                placeholder="Enter city or region (e.g. Hyderabad, Vijayawada)..." 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Searching...' : '🔍 Update Location'}
              </button>
            </div>
          </form>

          <div className="local-filters">
            <span className="filter-label">Preferred Language:</span>
            <div className="lang-buttons">
              <button 
                className={`lang-btn ${language === 'telugu' ? 'active' : ''}`}
                onClick={() => setLanguage('telugu')}
              >
                తెలుగు (Telugu)
              </button>
              <button 
                className={`lang-btn ${language === 'english' ? 'active' : ''}`}
                onClick={() => setLanguage('english')}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Local Bias Meter */}
        <div className="local-bias-meter-card">
          <h4>Local Bias Analysis Dashboard</h4>
          <p className="scope-indicator">Region: <strong>{searchLocation}</strong> ({language.toUpperCase()})</p>
          
          <div className="bias-gauge-container">
            <div className="bias-gauge-track">
              <div 
                className={`bias-gauge-fill ${biasStats.dominant.toLowerCase()}`}
                style={{ width: `${biasStats.ratio || 100}%` }}
              ></div>
            </div>
            <div className="bias-labels">
              <span>Left-Leaning</span>
              <span>Neutral</span>
              <span>Right-Leaning</span>
            </div>
          </div>

          <div className="bias-stats-grid">
            <div className="stat-box">
              <span className="stat-label">Dominant Tone</span>
              <span className={`stat-val ${biasStats.dominant.toLowerCase()}`}>
                {biasStats.dominant}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Bias Leaning Strength</span>
              <span className="stat-val">{biasStats.ratio}%</span>
            </div>
          </div>

          <div className="local-checked-sources">
            <span className="checked-label">Telugu Repositories Checked:</span>
            <div className="source-capsules">
              <span className="src-cap">📰 Sakshi.com</span>
              <span className="src-cap">📺 TV9 Telugu</span>
              <span className="src-cap">🌐 Google News RSS</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="local-news-loading">
          <div className="loading-spinner"></div>
          <p>Retrieving regional publications for {searchLocation}...</p>
        </div>
      ) : (
        <div className="local-articles-container">
          {articles.length === 0 ? (
            <div className="empty-local-state">
              <p>No regional news files located for "{searchLocation}". Try searching for another city, state, or region.</p>
            </div>
          ) : (
            <div className="local-articles-grid">
              {articles.map((article, index) => {
                const currentId = article.id || article.title;
                const isSpeaking = speakingId === currentId;
                
                return (
                  <a 
                    key={index} 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <article className={`local-article-card ${isSpeaking ? 'speaking-highlight' : ''}`}>
                      <div className="local-card-image">
                        <img src={article.image} alt={article.title} />
                        <span className="local-source-tag">{article.source}</span>
                      </div>
                      <div className="local-card-content">
                        <div className="local-card-meta">
                          <span>{article.author}</span>
                          <span>•</span>
                          <span>{article.time ? new Date(article.time).toLocaleDateString() : 'Recent'}</span>
                        </div>
                        <h4 className="local-article-title">{article.title}</h4>
                        <p className="local-article-description">{article.description}</p>
                        
                        <div className="speak-article-badge-row" style={{ marginTop: '12px', border: 'none', paddingTop: 0 }}>
                          <BiasAnalysis 
                            biasTone={article.bias_tone} 
                            biasAnalysis={article.bias_analysis} 
                          />
                          <button 
                            className={`listen-btn ${isSpeaking ? 'speaking' : ''}`}
                            onClick={(e) => handleSpeak(e, article)}
                            title={isSpeaking ? "Pause Narration" : "Listen via ElevenLabs Voice"}
                          >
                            {isSpeaking ? '⏹️ Stop' : '🔊 Listen'}
                          </button>
                        </div>
                      </div>
                    </article>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocalNewsSection;
