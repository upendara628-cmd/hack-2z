import React, { useState } from 'react';

const Header = ({ currentPage, onPageChange, onCategorySelect, activeCategory, user }) => {
  const [chatMessage, setChatMessage] = useState('');

  const handleChat = (e) => {
    setChatMessage(e.target.value);
  };

  return (
    <header className="header">
      {/* Main Navigation Bar */}
      <div className="header-top">
        <div className="header-container">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => onPageChange('home')}>
            THE MERIDIAN
          </div>
          <nav className="main-nav">
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); onPageChange('home'); }}
            >
              Home
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'ai-avatar' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); onPageChange('ai-avatar'); }}
            >
              AI Presenter
            </a>
            <a 
              href="#" 
              className={`nav-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); onPageChange('about'); }}
            >
              About
            </a>
            <button 
              className="nav-user-profile"
              onClick={() => onPageChange('dashboard')}
              title="Go to User Dashboard"
              style={{ marginLeft: '15px' }}
            >
              <img 
                className="nav-user-avatar" 
                src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"} 
                alt="User Profile" 
              />
              <span className={`nav-link-text ${currentPage === 'dashboard' ? 'active' : ''}`} style={{ color: currentPage === 'dashboard' ? '#c41e3a' : 'inherit', fontWeight: 'bold' }}>
                {user?.name || "Alex Johnson"}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Chat Bar Hero Section */}
      {currentPage === 'home' && (
        <div className="chat-bar-section">
          {/* Animated 3D Parallax Background */}
          <div className="chat-bar-bg-animated"></div>
          <div className="chat-bar-overlay"></div>
          
          <div className="chat-container" style={{ position: 'relative', zIndex: 2 }}>
            <div className="chat-bar">
              <input
                type="text"
                className="chat-input"
                placeholder="Type your message..."
                value={chatMessage}
                onChange={handleChat}
              />
              <button className="chat-send-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            {/* Centered Secondary Nav Links directly under search bar */}
            <nav className="hero-secondary-nav">
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'world' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('world'); }}
              >
                World
              </a>
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'politics' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('politics'); }}
              >
                Politics
              </a>
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'business' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('business'); }}
              >
                Business
              </a>
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'technology' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('technology'); }}
              >
                Technology
              </a>
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'science' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('science'); }}
              >
                Science
              </a>
              <a 
                href="#" 
                className={`hero-nav-link ${activeCategory === 'opinion' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onCategorySelect('opinion'); }}
              >
                Opinion
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
