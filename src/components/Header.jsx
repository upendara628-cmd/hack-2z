import React, { useState } from 'react';

const Header = () => {
  const [chatMessage, setChatMessage] = useState('');

  const handleChat = (e) => {
    setChatMessage(e.target.value);
  };

  return (
    <header className="header">
      {/* Main Navigation Bar */}
      <div className="header-top">
        <div className="header-container">
          <div className="logo">THE MERIDIAN</div>
          <nav className="main-nav">
            <a href="#" className="nav-link active">Home</a>
            <a href="#" className="nav-link">About</a>
            <a href="#" className="nav-link">Sign In</a>
          </nav>
        </div>
      </div>

      {/* Chat Bar */}
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

      {/* Secondary Navigation Bar */}
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
    </header>
  );
};

export default Header;
