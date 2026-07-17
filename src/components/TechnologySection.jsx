import React from 'react';

const TechnologySection = () => {
  const techArticles = [
    {
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop",
      title: "Nvidia's Next Datacenter Chip Will Consume More Power Than a Small Town",
      author: "Sofia Bertrand",
      time: "2 hrs ago"
    },
    {
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop",
      title: "The Browser Wars Return: Mozilla's Last Stand Against Chrome Dominance",
      author: "Rajan Patel",
      time: "3 hrs ago"
    },
    {
      image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=250&fit=crop",
      title: "How Teenagers in Lagos Are Building Software Companies at Scale",
      author: "Amara Osei",
      time: "7 hrs ago"
    }
  ];

  const opinionArticles = [
    {
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop",
      title: "The Liberal International Order Was Always a Story We Told Ourselves",
      author: "Prof. Natasha Volkov",
      title_role: "Senior Fellow, Brookings Institution"
    },
    {
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop",
      title: "Artificial Intelligence Won't Destroy Jobs. It Will Make Them Invisible.",
      author: "James Okafor",
      title_role: "Economist, Oxford University"
    },
    {
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop",
      title: "We've Spent Thirty Years Getting Urban Policy Wrong. Here's Why.",
      author: "Alicia Morales",
      title_role: "Director, Urban Policy Lab"
    }
  ];

  return (
    <section className="technology-section">
      <div className="container">
        <div className="two-column-layout">
          <div className="main-column">
            <div className="section-header">
              <h2 className="section-title">Technology</h2>
              <a href="#" className="view-all">ALL TECHNOLOGY →</a>
            </div>
            <div className="tech-articles">
              {techArticles.map((article, index) => (
                <article key={index} className="tech-article">
                  <div className="tech-image">
                    <img src={article.image} alt="Technology" />
                  </div>
                  <div className="tech-content">
                    <h4 className="tech-title">{article.title}</h4>
                    <div className="article-meta">
                      <span className="author">{article.author}</span>
                      <span className="time">{article.time}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="opinion-column">
            <div className="section-header">
              <h2 className="section-title">Opinion</h2>
              <a href="#" className="view-all">ALL OPINION →</a>
            </div>
            <div className="opinion-articles">
              {opinionArticles.map((article, index) => (
                <article key={index} className="opinion-article">
                  <div className="opinion-author">
                    <img src={article.image} alt="Author" />
                  </div>
                  <div className="opinion-content">
                    <h4 className="opinion-title">{article.title}</h4>
                    <p className="opinion-author-name">{article.author}</p>
                    <p className="opinion-author-title">{article.title_role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnologySection;
