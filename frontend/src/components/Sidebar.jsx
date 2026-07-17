import React from 'react';

const Sidebar = ({ onCategorySelect }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>POLITICS</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('politics'); }}>ALL POLITICS →</a>
        </div>
        <article className="sidebar-article">
          <span className="category-tag">POLITICS</span>
          <h4 className="sidebar-title">India-China Border Talks Resume After Two-Year Impasse</h4>
          <div className="article-meta">
            <span className="author">Arjun Kapoor</span>
            <span className="time">3 hours ago</span>
          </div>
        </article>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>TECHNOLOGY</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('technology'); }}>ALL TECHNOLOGY →</a>
        </div>
        <article className="sidebar-article">
          <span className="category-tag">TECHNOLOGY</span>
          <h4 className="sidebar-title">Nvidia's Next Datacenter Chip Will Consume More Power Than a Small Town</h4>
          <div className="article-meta">
            <span className="author">Sofia Bertrand</span>
            <span className="time">2 hours ago</span>
          </div>
        </article>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>BUSINESS</h3>
          <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onCategorySelect('business'); }}>ALL BUSINESS →</a>
        </div>
        <article className="sidebar-article">
          <span className="category-tag">BUSINESS</span>
          <h4 className="sidebar-title">Brazil's Amazon Deforestation Rate Drops 68% Under New Policies</h4>
          <div className="article-meta">
            <span className="author">Clara Ribeiro</span>
            <span className="time">5 hours ago</span>
          </div>
        </article>
      </div>
    </aside>
  );
};

export default Sidebar;
