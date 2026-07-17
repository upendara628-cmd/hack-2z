import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

/* ------------------------------------------------------------------
   Country list: name → {lat, lng, code}
------------------------------------------------------------------ */
const COUNTRIES = [
  { name: 'India', lat: 20.5937, lng: 78.9629, code: 'IN', flag: '🇮🇳' },
  { name: 'United States', lat: 37.0902, lng: -95.7129, code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', lat: 55.3781, lng: -3.436, code: 'GB', flag: '🇬🇧' },
  { name: 'China', lat: 35.8617, lng: 104.1954, code: 'CN', flag: '🇨🇳' },
  { name: 'Russia', lat: 61.524, lng: 105.3188, code: 'RU', flag: '🇷🇺' },
  { name: 'Germany', lat: 51.1657, lng: 10.4515, code: 'DE', flag: '🇩🇪' },
  { name: 'France', lat: 46.2276, lng: 2.2137, code: 'FR', flag: '🇫🇷' },
  { name: 'Brazil', lat: -14.235, lng: -51.9253, code: 'BR', flag: '🇧🇷' },
  { name: 'Australia', lat: -25.2744, lng: 133.7751, code: 'AU', flag: '🇦🇺' },
  { name: 'Japan', lat: 36.2048, lng: 138.2529, code: 'JP', flag: '🇯🇵' },
  { name: 'Canada', lat: 56.1304, lng: -106.3468, code: 'CA', flag: '🇨🇦' },
  { name: 'South Korea', lat: 35.9078, lng: 127.7669, code: 'KR', flag: '🇰🇷' },
  { name: 'Italy', lat: 41.8719, lng: 12.5674, code: 'IT', flag: '🇮🇹' },
  { name: 'Spain', lat: 40.4637, lng: -3.7492, code: 'ES', flag: '🇪🇸' },
  { name: 'Mexico', lat: 23.6345, lng: -102.5528, code: 'MX', flag: '🇲🇽' },
  { name: 'Indonesia', lat: -0.7893, lng: 113.9213, code: 'ID', flag: '🇮🇩' },
  { name: 'Pakistan', lat: 30.3753, lng: 69.3451, code: 'PK', flag: '🇵🇰' },
  { name: 'Bangladesh', lat: 23.685, lng: 90.3563, code: 'BD', flag: '🇧🇩' },
  { name: 'Nigeria', lat: 9.082, lng: 8.6753, code: 'NG', flag: '🇳🇬' },
  { name: 'South Africa', lat: -30.5595, lng: 22.9375, code: 'ZA', flag: '🇿🇦' },
  { name: 'Egypt', lat: 26.8206, lng: 30.8025, code: 'EG', flag: '🇪🇬' },
  { name: 'Turkey', lat: 38.9637, lng: 35.2433, code: 'TR', flag: '🇹🇷' },
  { name: 'Iran', lat: 32.4279, lng: 53.688, code: 'IR', flag: '🇮🇷' },
  { name: 'Ukraine', lat: 48.3794, lng: 31.1656, code: 'UA', flag: '🇺🇦' },
  { name: 'Argentina', lat: -38.4161, lng: -63.6167, code: 'AR', flag: '🇦🇷' },
  { name: 'Israel', lat: 31.0461, lng: 34.8516, code: 'IL', flag: '🇮🇱' },
  { name: 'Saudi Arabia', lat: 23.8859, lng: 45.0792, code: 'SA', flag: '🇸🇦' },
  { name: 'Thailand', lat: 15.87, lng: 100.9925, code: 'TH', flag: '🇹🇭' },
  { name: 'Poland', lat: 51.9194, lng: 19.1451, code: 'PL', flag: '🇵🇱' },
  { name: 'Netherlands', lat: 52.1326, lng: 5.2913, code: 'NL', flag: '🇳🇱' },
];

const BiasTag = ({ tone }) => {
  const cls = (tone || '').toLowerCase().includes('left') ? 'left-leaning'
    : (tone || '').toLowerCase().includes('right') ? 'right-leaning' : 'neutral';
  return <span className={`bias-badge ${cls}`} style={{ fontSize: '11px', padding: '2px 8px' }}>⚖️ {tone || 'Neutral'}</span>;
};

/* ------------------------------------------------------------------
   Main Globe Component
------------------------------------------------------------------ */
const GlobeView = () => {
  const globeRef = useRef(null);
  const containerRef = useRef(null);
  const [Globe, setGlobe] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState(COUNTRIES);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Lazy load the globe library
  useEffect(() => {
    import('react-globe.gl').then(module => {
      setGlobe(() => module.default);
    }).catch(err => console.error('Globe load error:', err));
  }, []);

  // Filter countries based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCountries(COUNTRIES);
    } else {
      setFilteredCountries(
        COUNTRIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  }, [searchQuery]);

  // Fetch live news for selected country
  const fetchCountryNews = useCallback(async (country) => {
    setLoading(true);
    setArticles([]);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/news?keyword=${encodeURIComponent(country.name + ' news crisis conflict')}`
      );
      const data = await res.json();
      setArticles(Array.isArray(data) ? data.slice(0, 12) : []);
    } catch (err) {
      console.error('Globe news fetch error:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCountryClick = useCallback((country) => {
    setSelectedCountry(country);
    fetchCountryNews(country);
    // Zoom globe to country
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: country.lat, lng: country.lng, altitude: 1.5 },
        1200
      );
    }
  }, [fetchCountryNews]);

  // Globe point markers
  const pointsData = COUNTRIES.map(c => ({
    lat: c.lat,
    lng: c.lng,
    name: c.name,
    flag: c.flag,
    country: c,
    size: selectedCountry?.code === c.code ? 1.4 : 0.7,
    color: selectedCountry?.code === c.code ? '#ff4757' : '#ffd32a',
  }));

  return (
    <div className="globe-page">
      {/* Page Header */}
      <div className="globe-header">
        <div className="globe-header-inner">
          <div className="globe-title-row">
            <span className="globe-earth-icon">🌍</span>
            <div>
              <h1 className="globe-title">Globe Crisis Monitor</h1>
              <p className="globe-subtitle">Click any country on the globe to get live crisis &amp; news alerts</p>
            </div>
          </div>
          {/* Country Search Bar */}
          <div className="globe-search-bar">
            <span className="globe-search-icon">🔍</span>
            <input
              type="text"
              className="globe-search-input"
              placeholder="Search country — India, USA, Ukraine..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="globe-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>
      </div>

      <div className="globe-layout">
        {/* Country Sidebar */}
        <div className="globe-sidebar">
          <div className="globe-sidebar-title">🗺️ Select a Country</div>
          <div className="globe-country-list">
            {filteredCountries.map(country => (
              <button
                key={country.code}
                className={`globe-country-btn ${selectedCountry?.code === country.code ? 'active' : ''}`}
                onClick={() => handleCountryClick(country)}
              >
                <span className="country-flag">{country.flag}</span>
                <span className="country-name">{country.name}</span>
                {selectedCountry?.code === country.code && (
                  <span className="country-selected-dot">●</span>
                )}
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <div className="globe-no-results">No country found for "{searchQuery}"</div>
            )}
          </div>
        </div>

        {/* Globe Canvas */}
        <div className="globe-canvas-wrap" ref={containerRef}>
          {Globe ? (
            <Globe
              ref={globeRef}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              pointsData={pointsData}
              pointAltitude="size"
              pointColor="color"
              pointRadius={0.6}
              pointLabel={d => `<div class="globe-tooltip"><span>${d.flag}</span> ${d.name}</div>`}
              onPointClick={d => handleCountryClick(d.country)}
              onPointHover={d => setHoveredCountry(d ? d.name : null)}
              atmosphereColor="#1a90ff"
              atmosphereAltitude={0.25}
              onGlobeReady={() => setGlobeReady(true)}
              width={containerRef.current?.clientWidth || 620}
              height={520}
            />
          ) : (
            <div className="globe-loading-spinner">
              <div className="globe-spinner-ring"></div>
              <p>Loading 3D Globe...</p>
            </div>
          )}
          {hoveredCountry && (
            <div className="globe-hover-label">{hoveredCountry}</div>
          )}
          {!selectedCountry && globeReady && (
            <div className="globe-hint-overlay">
              <span>👆 Click any glowing dot or select from the list</span>
            </div>
          )}
        </div>

        {/* News Panel */}
        <div className="globe-news-panel">
          {!selectedCountry ? (
            <div className="globe-news-empty">
              <div className="globe-news-empty-icon">🌐</div>
              <h3>Select a Country</h3>
              <p>Click on a glowing marker on the globe or pick a country from the list to see live news &amp; crisis alerts</p>
            </div>
          ) : (
            <>
              <div className="globe-news-panel-header">
                <span className="globe-news-flag">{selectedCountry.flag}</span>
                <div>
                  <h2 className="globe-news-country-title">{selectedCountry.name}</h2>
                  <span className="globe-news-live-badge">🔴 LIVE</span>
                </div>
              </div>

              {loading ? (
                <div className="globe-news-skeletons">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="globe-news-skeleton">
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                      <div className="skeleton-line short"></div>
                    </div>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <div className="globe-news-empty">
                  <p>No live articles found for {selectedCountry.name}. Try another country.</p>
                </div>
              ) : (
                <div className="globe-news-articles">
                  {articles.map((article, i) => (
                    <a
                      key={article.id || i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="globe-news-card"
                    >
                      <div className="globe-news-card-img-wrap">
                        <img
                          src={article.image}
                          alt={article.title}
                          className="globe-news-card-img"
                          onError={e => {
                            e.target.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=220&fit=crop';
                          }}
                        />
                        <span className="globe-news-source-tag">{article.source}</span>
                      </div>
                      <div className="globe-news-card-body">
                        <h4 className="globe-news-card-title">{article.title}</h4>
                        <p className="globe-news-card-desc">
                          {(article.description || '').slice(0, 100)}{(article.description || '').length > 100 ? '...' : ''}
                        </p>
                        <div className="globe-news-card-footer">
                          <span className="globe-news-card-time">🕐 {article.time}</span>
                          <BiasTag tone={article.bias_tone} />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobeView;
