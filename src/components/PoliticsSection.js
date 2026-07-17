import React from 'react';

const PoliticsSection = () => {
  const articles = [
    {
      image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=250&fit=crop",
      title: "Zelensky Meets with New EU Commission President in Brussels",
      author: "Ivan Yurchenko",
      time: "6 hours ago"
    },
    {
      image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&h=250&fit=crop",
      title: "What Happens When a Country Runs Out of Judges",
      author: "Prof. Natasha Volkov",
      time: "8 hours ago"
    },
    {
      image: "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=400&h=250&fit=crop",
      title: "The Liberal International Order Was Always a Story We Told Ourselves",
      author: "James Okafor",
      time: "12 hours ago"
    }
  ];

  return (
    <section className="politics-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Politics</h2>
          <a href="#" className="view-all">ALL POLITICS →</a>
        </div>
        <div className="politics-grid">
          {articles.map((article, index) => (
            <article key={index} className="politics-card">
              <div className="politics-image">
                <img src={article.image} alt="Politics" />
              </div>
              <span className="category-tag">POLITICS</span>
              <h4 className="politics-title">{article.title}</h4>
              <div className="article-meta">
                <span className="author">{article.author}</span>
                <span className="time">{article.time}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PoliticsSection;
