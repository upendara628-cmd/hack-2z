import React from 'react';
import Header from './components/Header';
import FeaturedArticle from './components/FeaturedArticle';
import Sidebar from './components/Sidebar';
import PoliticsSection from './components/PoliticsSection';
import TechnologySection from './components/TechnologySection';
import TrendingSection from './components/TrendingSection';
import NewsletterSection from './components/NewsletterSection';
import Footer from './components/Footer';
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
