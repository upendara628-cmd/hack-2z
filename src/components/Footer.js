import React from 'react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-columns">
          <div className="footer-column">
            <h4>NEWS</h4>
            <ul>
              <li><a href="#">World</a></li>
              <li><a href="#">Politics</a></li>
              <li><a href="#">Business</a></li>
              <li><a href="#">Technology</a></li>
              <li><a href="#">Science</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>OPINION</h4>
            <ul>
              <li><a href="#">Editorials</a></li>
              <li><a href="#">Contributors</a></li>
              <li><a href="#">Letters</a></li>
              <li><a href="#">Podcasts</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>COMPANY</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>SUBSCRIBE</h4>
            <ul>
              <li><a href="#">Newsletter</a></li>
              <li><a href="#">Digital Access</a></li>
              <li><a href="#">Gift Subscriptions</a></li>
              <li><a href="#">Group Subscriptions</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-brand">THE MERIDIAN</div>
          <div className="footer-copyright">© 2026 The Meridian Publishing Group. All rights reserved.</div>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
            <a href="#">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
