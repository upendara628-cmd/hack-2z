import React from 'react';
import Header from './components/Header.jsx';
import FeaturedArticle from './components/FeaturedArticle.jsx';
import Sidebar from './components/Sidebar.jsx';
import PoliticsSection from './components/PoliticsSection.jsx';
import TechnologySection from './components/TechnologySection.jsx';
import TrendingSection from './components/TrendingSection.jsx';
import NewsletterSection from './components/NewsletterSection.jsx';
import Footer from './components/Footer.jsx';
import './App.css';

function App() {
  return (
    <div className="App">
      <Header />
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
      <NewsletterSection />
      <Footer />
    </div>
  );
}

export default App;
