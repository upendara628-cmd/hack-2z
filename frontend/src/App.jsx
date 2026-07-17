import React, { useState } from 'react';
import Header from './components/Header.jsx';
import FeaturedArticle from './components/FeaturedArticle.jsx';
import Sidebar from './components/Sidebar.jsx';
import PoliticsSection from './components/PoliticsSection.jsx';
import TechnologySection from './components/TechnologySection.jsx';
import TrendingSection from './components/TrendingSection.jsx';
import NewsletterSection from './components/NewsletterSection.jsx';
import Footer from './components/Footer.jsx';
import UserDashboard from './components/UserDashboard.jsx';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="App">
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      
      {currentPage === 'home' && (
        <main className="main-content">
          <div className="container">
            <div className="top-section">
              <FeaturedArticle />
              <Sidebar />
            </div>
          </div>
          <PoliticsSection />
          <TechnologySection />
          <TrendingSection />
        </main>
      )}

      {currentPage === 'dashboard' && (
        <UserDashboard />
      )}

      {currentPage === 'about' && (
        <div className="dashboard-container">
          <h1 className="dashboard-title-header">About The Meridian</h1>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#334155', margin: 0 }}>
              The Meridian is a next-generation news aggregator and political analysis engine. Using advanced AI bias classification with Groq and Llama-3.1, we analyze top headlines from multiple global and local sources to provide transparency in news framing and reporting.
            </p>
            <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#334155', marginTop: '20px', marginBottom: 0 }}>
              Our platform checks multiple web repositories using geolocation features to pinpoint nearby publications, mapping political leaning percentages visually on our custom dashboard panels.
            </p>
          </div>
        </div>
      )}

      <NewsletterSection />
      <Footer />
    </div>
  );
}

export default App;
