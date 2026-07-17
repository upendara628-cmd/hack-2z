import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const TrendingSection = () => {
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/news?keyword=general`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setTrendingArticles(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching trending news:', err);
        setLoading(false);
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

  const defaultTrendingArticles = [
    { category: "WORLD", title: "What Happens When a Country Runs Out of Judges", url: "#" },
    { category: "BUSINESS", title: "The Hidden Cost of Free Shipping", url: "#" },
    { category: "SCIENCE", title: "A New Antibiotic Could End the Era of Superbugs", url: "#" },
    { category: "ENVIRONMENT", title: "Inside the Life of a Deep-Sea Mining Pioneer", url: "#" },
    { category: "SPORTS", title: "The Stadium That Embarrassed a Nation", url: "#" }
  ];

  const displayArticles = trendingArticles.length > 0 ? trendingArticles : defaultTrendingArticles;

  return (
    <section className="trending-section">
      <div className="container">
        <div className="trending-header">
          <h2 className="section-title">Trending</h2>
          <a href="#" className="view-all">ALL TRENDING →</a>
        </div>
        <div className="trending-list">
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading trending stories...</div>
          ) : (
            displayArticles.slice(0, 5).map((article, index) => {
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
                  <article className={`trending-item ${isSpeaking ? 'article-card-speaking-highlight' : ''}`}>
                    <span className="trending-number">{index + 1}</span>
                    <div className="trending-content" style={{ width: '100%' }}>
                      <span className="category-tag">{article.category || 'WORLD'}</span>
                      <h4 className="trending-title">{article.title}</h4>
                      
                      <div className="speak-article-badge-row" style={{ border: 'none', paddingTop: 0, marginTop: '5px' }}>
                        <span></span>
                        <button 
                          className={`article-speak-btn ${isSpeaking ? 'active-speaking' : ''}`}
                          onClick={(e) => handleSpeak(e, article)}
                        >
                          {isSpeaking ? '⏹️ Stop' : '🔊 Listen'}
                        </button>
                      </div>
                    </div>
                  </article>
                </a>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
