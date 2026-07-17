import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';

const BiasTag = ({ tone }) => {
  const cls = tone?.toLowerCase().includes('left') ? 'left-leaning'
    : tone?.toLowerCase().includes('right') ? 'right-leaning' : 'neutral';
  return <span className={`bias-badge ${cls}`}>⚖️ {tone || 'Neutral'}</span>;
};

const SearchView = ({ query, onBack }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTime, setSearchTime] = useState(0);
  const [biasStats, setBiasStats] = useState({ left: 0, right: 0, neutral: 0 });
  const abortRef = useRef(null);

  const calculateBiasStats = (articleList) => {
    if (articleList.length === 0) return;
    let left = 0, right = 0, neutral = 0;
    articleList.forEach(art => {
      const tone = (art.bias_tone || 'neutral').toLowerCase();
      if (tone.includes('left')) left++;
      else if (tone.includes('right')) right++;
      else neutral++;
    });
    const total = articleList.length;
    setBiasStats({
      left: Math.round((left / total) * 100),
      right: Math.round((right / total) * 100),
      neutral: Math.round((neutral / total) * 100)
    });
  };

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError('');
    setArticles([]);
    const t0 = performance.now();

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    fetch(`${API_BASE_URL}/api/news?keyword=${encodeURIComponent(query)}`, {
      signal: abortRef.current.signal
    })
      .then(r => r.json())
      .then(data => {
        const articleList = Array.isArray(data) ? data : [];
        setArticles(articleList);
        calculateBiasStats(articleList);
        setSearchTime(((performance.now() - t0) / 1000).toFixed(2));
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError('Failed to fetch search results. Please try again.');
          setLoading(false);
        }
      });

    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [query]);

  return (
    <div className="search-view-container">
      <div className="search-view-header">
        <button className="search-back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="search-meta">
          {!loading && (
            <span className="search-result-count">
              {articles.length > 0
                ? `${articles.length} results for "${query}" — ${searchTime}s`
                : `No results for "${query}"`}
            </span>
          )}
          <div className="search-source-tags">
            <span className="search-source-tag currents">CurrentsAPI</span>
            <span className="search-source-tag newsdata">NewsData.io</span>
            <span className="search-source-tag gnews">GNews</span>
          </div>
        </div>
      </div>

      {/* Media Bias Split Panel */}
      {!loading && !error && articles.length > 0 && (
        <div className="chart-panel" style={{ marginBottom: '30px' }}>
          <h2 className="panel-title">📊 Media Bias Split inside search results for "{query}"</h2>
          
          <div className="chart-container-visual">
            {/* Left Leaning Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Left-Leaning</span>
                <span>{biasStats.left}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill left-leaning" style={{ width: `${biasStats.left}%` }}></div>
              </div>
            </div>

            {/* Neutral Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Neutral / Balanced</span>
                <span>{biasStats.neutral}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill neutral" style={{ width: `${biasStats.neutral}%` }}></div>
              </div>
            </div>

            {/* Right Leaning Bar */}
            <div className="chart-bar-row">
              <div className="chart-bar-label">
                <span>Right-Leaning</span>
                <span>{biasStats.right}%</span>
              </div>
              <div className="chart-bar-bg">
                <div className="chart-bar-fill right-leaning" style={{ width: `${biasStats.right}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="search-results-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="search-card-skeleton">
              <div className="skeleton-img"></div>
              <div className="skeleton-body">
                <div className="skeleton-line long"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="search-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && articles.length === 0 && (
        <div className="search-empty">
          <div className="search-empty-icon">🔍</div>
          <h3>No results found for <em>"{query}"</em></h3>
          <p>Try different keywords — e.g. "politics", "AI", "climate", "sports"</p>
          <button className="search-try-btn" onClick={onBack}>← Browse Categories</button>
        </div>
      )}

      {/* Results Grid */}
      {!loading && !error && articles.length > 0 && (
        <>
          <div className="search-results-grid">
            {articles.map((article, i) => (
              <a key={article.id || i} href={article.url} target="_blank" rel="noopener noreferrer"
                className="search-result-card">
                <div className="search-card-img-wrap">
                  <img src={article.image} alt={article.title}
                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=300&fit=crop'; }}
                    className="search-card-img" />
                  <span className="search-card-source-tag">{article.source}</span>
                </div>
                <div className="search-card-body">
                  <h3 className="search-card-title">{article.title}</h3>
                  <p className="search-card-desc">{article.description?.slice(0, 120)}{article.description?.length > 120 ? '...' : ''}</p>
                  <div className="search-card-footer">
                    <span className="search-card-meta">
                      <span className="search-card-author">✍️ {article.author}</span>
                      <span className="search-card-time">🕐 {article.time}</span>
                    </span>
                    <BiasTag tone={article.bias_tone} />
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="search-footer-note">
            <p>🤖 All articles analyzed by Groq Llama-3.1 for political bias · Sources: CurrentsAPI · NewsData.io · GNews · Google News RSS</p>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchView;
