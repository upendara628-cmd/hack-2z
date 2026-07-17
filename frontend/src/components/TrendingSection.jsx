import React, { useState, useEffect } from 'react';

const TrendingSection = () => {
  const [trendingArticles, setTrendingArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:5000/api/news?keyword=general')
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
            displayArticles.slice(0, 5).map((article, index) => (
              <a 
                key={index} 
                href={article.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article className="trending-item">
                  <span className="trending-number">{index + 1}</span>
                  <div className="trending-content">
                    <span className="category-tag">{article.category || 'WORLD'}</span>
                    <h4 className="trending-title">{article.title}</h4>
                  </div>
                </article>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
