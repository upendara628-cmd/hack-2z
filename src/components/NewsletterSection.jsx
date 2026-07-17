import React, { useState } from 'react';

const NewsletterSection = () => {
  const [email, setEmail] = useState('name@example.com');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Subscribed with: ${email}`);
  };

  return (
    <section className="newsletter-section">
      <div className="newsletter-container">
        <div className="newsletter-content">
          <h2 className="newsletter-title">The briefing that shapes how the world reads the news.</h2>
          <p className="newsletter-text">Get our daily newsletter delivered to your inbox every morning.</p>
        </div>
        <div className="newsletter-form">
          <label className="newsletter-label">YOUR EMAIL ADDRESS</label>
          <input 
            type="email" 
            className="newsletter-input" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="newsletter-btn" onClick={handleSubmit}>SUBSCRIBE</button>
          <p className="newsletter-disclaimer">Free. Unsubscribe anytime. No tracking.</p>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
