import React from 'react';

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">THE MERIDIAN</div>
        <nav className="nav">
          <a href="#" className="nav-link active">World</a>
          <a href="#" className="nav-link">Politics</a>
          <a href="#" className="nav-link">Business</a>
          <a href="#" className="nav-link">Technology</a>
          <a href="#" className="nav-link">Science</a>
          <a href="#" className="nav-link">Opinion</a>
        </nav>
        <div className="header-right">
          <a href="#" className="subscribe-btn">Subscribe</a>
          <a href="#" className="sign-in">Sign In</a>
        </div>
      </div>
    </header>
  );
};

export default Header;
