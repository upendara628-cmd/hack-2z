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
        <div className="bias-analysis-content">
          <h5>AI Bias Report</h5>
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

const CardSkeleton = () => (
  <div className="skeleton-card">
    <div className="skeleton-image"></div>
    <div className="skeleton-title" style={{ height: '18px', width: '80%' }}></div>
    <div className="skeleton-text" style={{ height: '12px', width: '50%', marginTop: '6px' }}></div>
  </div>
);

const PoliticsSection = ({ onCategorySelect }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/news?keyword=politics`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setArticles(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching politics news:', err);
        setLoading(false);
      });
  }, []);

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

  const defaultArticles = [
    {
      image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=250&fit=crop",
      title: "Zelensky Meets with New EU Commission President in Brussels",
      author: "Ivan Yurchenko",
      time: "6 hours ago",
      url: "#",
      bias_tone: "Neutral",
      bias_analysis: [
        "Provides balanced coverage quoting representatives from both developing and developed nations.",
        "Relies primarily on official press releases which maintains standard diplomatic tone.",
        "Focuses on policy commitments without editorializing."
      ]
    },
    {
      image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&h=250&fit=crop",
      title: "What Happens When a Country Runs Out of Judges",
      author: "Prof. Natasha Volkov",
      time: "8 hours ago",
      url: "#",
      bias_tone: "Neutral",
      bias_analysis: [
        "Objective reporting on structural issues within judicial appointments.",
        "Highlights the lack of resources using verified court backlogs.",
        "Includes call for legislative reform from legal experts."
      ]
    },
    {
      image: "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=400&h=250&fit=crop",
      title: "The Liberal International Order Was Always a Story We Told Ourselves",
      author: "James Okafor",
      time: "12 hours ago",
      url: "#",
      bias_tone: "Left-Leaning",
      bias_analysis: [
        "Frames traditional alliances as outdated and in decline.",
        "Focuses on critical historical critiques of international organizations.",
        "Omits viewpoints defending historical post-war stability."
      ]
    }
  ];

  const displayArticles = articles.length > 0 ? articles : defaultArticles;

  return (
    <section className="politics-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Politics</h2>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('politics'); }}>ALL POLITICS →</a>
        </div>
        <div className="politics-grid">
          {loading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            displayArticles.slice(0, 3).map((article, index) => {
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
                  <article className={`politics-card ${isSpeaking ? 'article-card-speaking-highlight' : ''}`}>
                    <div className="politics-image">
                      <img 
                        src={article.image} 
                        alt={article.title} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=250&fit=crop";
                        }}
                      />
                    </div>
                    <span className="category-tag">POLITICS</span>
                    <h4 className="politics-title">{article.title}</h4>
                    <div className="article-meta">
                      <span className="author">{article.author}</span>
                      <span className="time">{article.time}</span>
                    </div>
                    
                    <div className="speak-article-badge-row" style={{ marginTop: '10px' }}>
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

export default PoliticsSection;
