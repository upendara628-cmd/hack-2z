import React, { useState } from 'react';

const Header = ({ currentPage, onPageChange }) => {
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
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" 
                alt="User Profile" 
              />
              <span className={`nav-link-text ${currentPage === 'dashboard' ? 'active' : ''}`} style={{ color: currentPage === 'dashboard' ? '#c41e3a' : 'inherit', fontWeight: 'bold' }}>
                Alex Johnson
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Chat Bar */}
      {currentPage === 'home' && (
        <div className="chat-bar-section">
          <div className="chat-container">
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
          </div>
        </div>
      )}

      {/* Secondary Navigation Bar */}
      {currentPage === 'home' && (
        <div className="header-bottom">
          <div className="header-container">
            <nav className="secondary-nav">
              <a href="#" className="nav-link active">World</a>
              <a href="#" className="nav-link">Politics</a>
              <a href="#" className="nav-link">Business</a>
              <a href="#" className="nav-link">Technology</a>
              <a href="#" className="nav-link">Science</a>
              <a href="#" className="nav-link">Opinion</a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
