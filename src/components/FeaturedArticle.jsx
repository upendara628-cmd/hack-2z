import React from 'react';

const FeaturedArticle = () => {
  return (
    <section className="featured-section">
      <div className="featured-article">
        <div className="featured-image">
          <img src="https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=500&fit=crop" alt="Wind turbines at sunset" />
        </div>
        <div className="featured-content">
          <span className="category">WORLD</span>
          <h1 className="featured-title">Germany's Last Coal Plant Closes, Completing a Decade-Long Energy Transition</h1>
          <p className="featured-excerpt">The historic shutdown marks the end of an era for Europe's largest economy, which has spent billions shifting to renewable energy sources.</p>
          <div className="article-meta">
            <span className="author">Elena Schwarz</span>
            <span className="time">1 hour ago</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedArticle;
