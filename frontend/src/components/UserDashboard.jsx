import React, { useState, useEffect } from 'react';
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

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('Detecting...');
  const [countryCode, setCountryCode] = useState('');
  const [coords, setCoords] = useState(null);
  const [articles, setArticles] = useState([]);
  const [biasStats, setBiasStats] = useState({ left: 0, right: 0, neutral: 0 });
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    // 1. Get location
    const detectLocation = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const lat = position.coords.latitude;
              const lon = position.coords.longitude;
              setCoords({ lat, lon });
              // Reverse geocode using a free public endpoint
              try {
                const response = await fetch(`https://ipapi.co/json/`);
                const data = await response.json();
                setLocationName(`${data.city || 'Local Area'}, ${data.country_name || 'Your Country'}`);
                setCountryCode(data.country ? data.country.toLowerCase() : 'us');
                fetchLocalNews(data.country ? data.country.toLowerCase() : 'us', data.city || '');
              } catch (err) {
                // Fallback coordinates description
                setLocationName(`Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`);
                setCountryCode('us');
                fetchLocalNews('us', '');
              }
            },
            async (err) => {
              console.log("Geolocation permission denied/failed. Trying IP-based location...");
              await fetchIPLocation();
            }
          );
        } else {
          await fetchIPLocation();
        }
      } catch (e) {
        console.error("Error detecting location:", e);
        setLocationName("London, United Kingdom (Default)");
        setCountryCode("gb");
        fetchLocalNews("gb", "London");
      }
    };

    const fetchIPLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.city) {
          setLocationName(`${data.city}, ${data.country_name}`);
          setCountryCode(data.country.toLowerCase());
          fetchLocalNews(data.country.toLowerCase(), data.city);
        } else {
          throw new Error("Invalid IP response");
        }
      } catch (err) {
        // Fallback to US
        setLocationName("New York, United States (Default)");
        setCountryCode("us");
        fetchLocalNews("us", "New York");
      }
    };

    const fetchLocalNews = async (cc, city) => {
      setLoading(true);
      try {
        // Fetch from local python backend
        let url = `${API_BASE_URL}/api/news?country=${cc}`;
        let response = await fetch(url);
        let data = await response.json();

        // If no articles found, try fetching using city keyword
        if (!data || data.length === 0) {
          url = `${API_BASE_URL}/api/news?keyword=${city || 'politics'}`;
          response = await fetch(url);
          data = await response.json();
        }

        setArticles(data || []);
        calculateBiasStats(data || []);
      } catch (err) {
        console.error("Error fetching local news:", err);
      } finally {
        setLoading(false);
      }
    };

    detectLocation();
  }, []);

  useEffect(() => {
    if (!loading && articles.length > 0 && locationName !== 'Detecting...') {
      const logLocationStats = async () => {
        try {
          await fetch(`${API_BASE_URL}/api/location-stats`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              location_name: locationName,
              country_code: countryCode,
              coords: coords,
              bias_stats: biasStats
            })
          });
        } catch (err) {
          console.error("Error logging location stats:", err);
        }
      };
      logLocationStats();
    }
  }, [loading, articles, locationName, countryCode, coords, biasStats]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = (e, article) => {
    e.preventDefault();
    e.stopPropagation();

    const id = article.id || article.title;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      window.speechSynthesis.cancel();
      setSpeakingId(id);
      
      const cleanDesc = article.description ? article.description.replace(/<[^>]*>/g, '') : '';
      const textToSpeak = `${article.title}. ${cleanDesc}`;
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
  };

  const calculateBiasStats = (articleList) => {
    if (articleList.length === 0) {
      setBiasStats({ left: 33, right: 33, neutral: 34 });
      return;
    }

    let leftCount = 0;
    let rightCount = 0;
    let neutralCount = 0;

    articleList.forEach((art) => {
      const tone = art.bias_tone?.toLowerCase() || 'neutral';
      if (tone.includes('left')) leftCount++;
      else if (tone.includes('right')) rightCount++;
      else neutralCount++;
    });

    const total = articleList.length;
    setBiasStats({
      left: Math.round((leftCount / total) * 100),
      right: Math.round((rightCount / total) * 100),
      neutral: Math.round((neutralCount / total) * 100)
    });
  };

  const getBiasSummaryText = () => {
    const { left, right, neutral } = biasStats;
    if (left > right && left > neutral) {
      return `The local news landscape in your area is currently left-leaning, with ${left}% of analyzed articles presenting left-leaning perspectives.`;
    } else if (right > left && right > neutral) {
      return `The local news landscape in your area is currently right-leaning, with ${right}% of analyzed articles presenting right-leaning perspectives.`;
    } else if (neutral > left && neutral > right) {
      return `The local news landscape in your area is highly balanced and neutral, with ${neutral}% of analyzed articles showing objective and balanced framing.`;
    }
    return "The local news coverage shows a balanced split across left, right, and neutral framing.";
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title-header">Your Location Dashboard</h1>
      
      <div className="dashboard-grid">
        {/* Geolocation Info Panel */}
        <div className="location-panel">
          <h2 className="panel-title">📍 Detected Location</h2>
          <div className="location-info">
            <div className="location-icon-wrapper">🌍</div>
            <div className="location-text">
              <span className="location-label">Current Region</span>
              <span className="location-value">{locationName}</span>
              {coords && (
                <span className="location-coords">
                  Lat: {coords.lat.toFixed(4)}, Lon: {coords.lon.toFixed(4)}
                </span>
              )}
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>
            Our algorithm automatically detects your location using browser geolocation services and falls back to IP-based routing if permissions are unavailable. We query multiple global resources to fetch headlines closest to you.
          </p>
        </div>

        {/* Bias Graph Panel */}
        <div className="chart-panel">
          <h2 className="panel-title">📊 Political Bias Tone Breakdown</h2>
          
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

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color left-leaning"></span>
              <span>Left-Leaning</span>
            </div>
            <div className="legend-item">
              <span className="legend-color neutral"></span>
              <span>Neutral</span>
            </div>
            <div className="legend-item">
              <span className="legend-color right-leaning"></span>
              <span>Right-Leaning</span>
            </div>
          </div>

          <div className="bias-summary-card">
            <strong>Analysis:</strong> {getBiasSummaryText()}
          </div>
        </div>
      </div>

      {/* Local News List */}
      <div className="dashboard-articles-section">
        <h2 className="dashboard-articles-title">📰 Headlines Near You ({locationName.split(',')[0]})</h2>
        
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
            <div className="skeleton-animation" style={{ height: '100px', marginBottom: '15px', borderRadius: '8px' }}></div>
            <div className="skeleton-animation" style={{ height: '100px', marginBottom: '15px', borderRadius: '8px' }}></div>
            <p>Gathering regional publications and performing AI bias audits...</p>
          </div>
        ) : articles.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
            No local news coverage found for your exact location. Showing default global headlines.
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

export default UserDashboard;
