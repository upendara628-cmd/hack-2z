import React, { useState, useEffect } from 'react';

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
    <div className="bias-container" style={{ border: 'none', padding: 0 }}>
      <div className="bias-header-row" style={{ marginTop: '5px' }}>
        <span className={`bias-badge ${getBadgeClass(biasTone)}`} style={{ transform: 'scale(0.95)' }}>
          ⚖️ {biasTone}
        </span>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
          className="bias-analysis-toggle"
          style={{ fontSize: '10px' }}
        >
          {isOpen ? 'Hide AI ▲' : 'Show AI ▼'}
        </button>
      </div>
      {isOpen && (
        <div className="bias-analysis-content" style={{ padding: '8px', marginTop: '6px' }}>
          <h5 style={{ fontSize: '10px' }}>AI Bias Report</h5>
          <ul className="bias-analysis-list" style={{ fontSize: '11px' }}>
            {biasAnalysis && biasAnalysis.map((bullet, idx) => (
              <li key={idx}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const TechSkeleton = () => (
  <div className="tech-article" style={{ width: '100%' }}>
    <div className="skeleton-image" style={{ width: '200px', height: '130px', flexShrink: 0 }}></div>
    <div className="tech-content" style={{ flex: 1 }}>
      <div className="skeleton-title" style={{ height: '16px', width: '90%' }}></div>
      <div className="skeleton-text" style={{ height: '12px', width: '40%', marginTop: '8px' }}></div>
    </div>
  </div>
);

const TechnologySection = ({ onCategorySelect }) => {
  const [techArticles, setTechArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/news?keyword=technology')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setTechArticles(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching tech news:', err);
        setLoading(false);
      });
  }, []);

  const defaultTechArticles = [
    {
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop",
      title: "Nvidia's Next Datacenter Chip Will Consume More Power Than a Small Town",
      author: "Sofia Bertrand",
      time: "2 hrs ago",
      url: "#",
      bias_tone: "Neutral",
      bias_analysis: [
        "Identifies semiconductor chip hardware power parameters factually.",
        "Draws energy comparisons to illustrate scale clearly.",
        "Avoids commercial promotion or negative environmental bias."
      ]
    },
    {
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop",
      title: "The Browser Wars Return: Mozilla's Last Stand Against Chrome Dominance",
      author: "Rajan Patel",
      time: "3 hrs ago",
      url: "#",
      bias_tone: "Left-Leaning",
      bias_analysis: [
        "Frames open-source initiatives with slightly positive sentiment.",
        "Highlights Chrome's dominance as a monopolistic threat.",
        "Omits Chrome team's official arguments about performance."
      ]
    },
    {
      image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=250&fit=crop",
      title: "How Teenagers in Lagos Are Building Software Companies at Scale",
      author: "Amara Osei",
      time: "7 hrs ago",
      url: "#",
      bias_tone: "Neutral",
      bias_analysis: [
        "Inspirational framing focused on developer community growth.",
        "Quotes local startup founders and organizers directly.",
        "Maintains positive yet factual coverage."
      ]
    }
  ];

  const opinionArticles = [
    {
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop",
      title: "The Liberal International Order Was Always a Story We Told Ourselves",
      author: "Prof. Natasha Volkov",
      title_role: "Senior Fellow, Brookings Institution"
    },
    {
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop",
      title: "Artificial Intelligence Won't Destroy Jobs. It Will Make Them Invisible.",
      author: "James Okafor",
      title_role: "Economist, Oxford University"
    },
    {
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop",
      title: "We've Spent Thirty Years Getting Urban Policy Wrong. Here's Why.",
      author: "Alicia Morales",
      title_role: "Director, Urban Policy Lab"
    }
  ];

  const displayTechArticles = techArticles.length > 0 ? techArticles : defaultTechArticles;

  return (
    <section className="technology-section">
      <div className="container">
        <div className="two-column-layout">
          <div className="main-column">
            <div className="section-header">
              <h2 className="section-title">Technology</h2>
              <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('technology'); }}>ALL TECHNOLOGY →</a>
            </div>
            <div className="tech-articles">
              {loading ? (
                <>
                  <TechSkeleton />
                  <TechSkeleton />
                  <TechSkeleton />
                </>
              ) : (
                displayTechArticles.slice(0, 3).map((article, index) => (
                  <a 
                    key={index} 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <article className="tech-article">
                      <div className="tech-image">
                        <img 
                          src={article.image} 
                          alt={article.title} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop";
                          }}
                        />
                      </div>
                      <div className="tech-content" style={{ width: '100%' }}>
                        <h4 className="tech-title">{article.title}</h4>
                        <div className="article-meta">
                          <span className="author">{article.author}</span>
                          <span className="time">{article.time}</span>
                        </div>
                        
                        <BiasAnalysis 
                          biasTone={article.bias_tone} 
                          biasAnalysis={article.bias_analysis} 
                        />
                      </div>
                    </article>
                  </a>
                ))
              )}
            </div>
          </div>

          <div className="opinion-column">
            <div className="section-header">
              <h2 className="section-title">Opinion</h2>
              <a href="#" className="view-all">ALL OPINION →</a>
            </div>
            <div className="opinion-articles">
              {opinionArticles.map((article, index) => (
                <article key={index} className="opinion-article">
                  <div className="opinion-author">
                    <img src={article.image} alt={article.author} />
                  </div>
                  <div className="opinion-content">
                    <h4 className="opinion-title">{article.title}</h4>
                    <p className="opinion-author-name">{article.author}</p>
                    <p className="opinion-author-title">{article.title_role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnologySection;
