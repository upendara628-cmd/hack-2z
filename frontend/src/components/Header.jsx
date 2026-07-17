import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const Header = ({ currentPage, onPageChange, onCategorySelect, activeCategory, user, onSearch }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced live search suggestions
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    setIsFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/news?keyword=${encodeURIComponent(q)}`);
      const data = await res.json();
      // Use up to 5 article titles as suggestions
      setSuggestions((data || []).slice(0, 5).map(a => ({ title: a.title, source: a.source, id: a.id })));
    } catch {
      setSuggestions([]);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 500);
  };

  const handleSearch = (searchTerm) => {
    const term = (searchTerm || query).trim();
    if (!term) return;
    setQuery(term);
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(term);
    onPageChange('search');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSuggestionClick = (title) => {
    setQuery(title);
    handleSearch(title);
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
            <a href="#" className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onPageChange('home'); }}>Home</a>
            <a href="#" className={`nav-link ${currentPage === 'ai-avatar' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onPageChange('ai-avatar'); }}>AI Presenter</a>
            <a href="#" className={`nav-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onPageChange('about'); }}>About</a>
            <button className="nav-user-profile" onClick={() => onPageChange('dashboard')}
              title="Go to User Dashboard" style={{ marginLeft: '15px' }}>
              <img className="nav-user-avatar"
                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=3b82f6&color=fff&size=100`}
                alt="User Profile" onError={e => { e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'; }} />
              <span className={`nav-link-text ${currentPage === 'dashboard' ? 'active' : ''}`}
                style={{ color: currentPage === 'dashboard' ? '#c41e3a' : 'inherit', fontWeight: 'bold' }}>
                {user?.name || 'User'}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Search Bar Hero Section */}
      {currentPage === 'home' || currentPage === 'search' ? (
        <div className="chat-bar-section">
          <div className="chat-bar-bg-animated"></div>
          <div className="chat-bar-overlay"></div>

          <div className="chat-container" style={{ position: 'relative', zIndex: 2 }}>
            {/* Search Input with live suggestions */}
            <div ref={wrapperRef} className="search-wrapper">
              <div className="chat-bar">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Search news — politics, tech, science, sports..."
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (query.length >= 2) setShowSuggestions(true); }}
                  autoComplete="off"
                />
                <button className="chat-send-btn" onClick={() => handleSearch()}>
                  {isFetching ? (
                    <div className="search-spinner"></div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
                      <path d="M21 21L16.65 16.65" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Live Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions-dropdown">
                  <div className="suggestions-header">
                    <span className="suggestions-label">🔍 Live Results</span>
                    <button className="suggestions-close" onClick={() => setShowSuggestions(false)}>✕</button>
                  </div>
                  {suggestions.map((s, i) => (
                    <button key={i} className="suggestion-item" onClick={() => handleSuggestionClick(s.title)}>
                      <span className="suggestion-icon">📰</span>
                      <div className="suggestion-content">
                        <span className="suggestion-title">{s.title}</span>
                        <span className="suggestion-source">{s.source}</span>
                      </div>
                    </button>
                  ))}
                  <button className="suggestion-search-all" onClick={() => handleSearch()}>
                    Search all results for "<strong>{query}</strong>" →
                  </button>
                </div>
              )}

              {/* Loading suggestion skeleton */}
              {showSuggestions && isFetching && query.length >= 2 && suggestions.length === 0 && (
                <div className="search-suggestions-dropdown">
                  <div className="suggestions-header">
                    <span className="suggestions-label">⏳ Searching live news...</span>
                  </div>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="suggestion-skeleton">
                      <div className="skeleton-icon"></div>
                      <div className="skeleton-lines">
                        <div className="skeleton-line long"></div>
                        <div className="skeleton-line short"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Pills */}
            <nav className="hero-secondary-nav">
              {['world', 'politics', 'business', 'technology', 'science', 'opinion'].map(cat => (
                <a key={cat} href="#"
                  className={`hero-nav-link ${activeCategory === cat ? 'active' : ''}`}
                  onClick={e => { e.preventDefault(); setQuery(''); setShowSuggestions(false); onCategorySelect(cat); }}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Header;
