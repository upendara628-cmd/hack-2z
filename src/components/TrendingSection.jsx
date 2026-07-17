import React from 'react';

const TrendingSection = () => {
  const trendingArticles = [
    { category: "WORLD", title: "What Happens When a Country Runs Out of Judges" },
    { category: "BUSINESS", title: "The Hidden Cost of Free Shipping" },
    { category: "SCIENCE", title: "A New Antibiotic Could End the Era of Superbugs" },
    { category: "ENVIRONMENT", title: "Inside the Life of a Deep-Sea Mining Pioneer" },
    { category: "SPORTS", title: "The Stadium That Embarrassed a Nation" }
  ];

  return (
    <section className="trending-section">
      <div className="container">
        <div className="trending-header">
          <h2 className="section-title">Trending</h2>
          <a href="#" className="view-all">ALL TRENDING →</a>
        </div>
        <div className="trending-list">
          {trendingArticles.map((article, index) => (
            <article key={index} className="trending-item">
              <span className="trending-number">{index + 1}</span>
              <div className="trending-content">
                <span className="category-tag">{article.category}</span>
                <h4 className="trending-title">{article.title}</h4>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;
