import React, { useState, useEffect, useRef } from 'react';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const googleButtonRef = useRef(null);

  // Google Sign-In Client ID from the extra folder project
  const GOOGLE_CLIENT_ID = '572065042143-j3ilmq1fmb2q44rik34dq8ci9d1pb1q2.apps.googleusercontent.com';

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts && googleButtonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback,
            auto_select: false,
          });

          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: '100%',
          });
        } catch (error) {
          console.error('Google Sign-In initialization error:', error);
        }
      }
    };

    if (window.google && window.google.accounts) {
      initializeGoogleSignIn();
    } else {
      const checkGoogleLoaded = setInterval(() => {
        if (window.google && window.google.accounts) {
          initializeGoogleSignIn();
          clearInterval(checkGoogleLoaded);
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      if (!email || !password) return;
      onLogin({
        name: email.split('@')[0],
        email: email,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
      });
    } else {
      if (!name || !email || !password || password !== confirmPassword) {
        if (password !== confirmPassword) alert("Passwords do not match!");
        return;
      }
      onLogin({
        name: name,
        email: email,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
      });
    }
  };

  const handleGoogleCallback = (response) => {
    try {
      const payload = parseJwt(response.credential);
      if (payload) {
        onLogin({
          name: payload.name,
          email: payload.email,
          avatar: payload.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
        });
      }
    } catch (err) {
      console.error("Google authentication parsing failed:", err);
    }
  };

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error parsing JWT:', e);
      return null;
    }
  };

  return (
    <div className="login-page-container">
      {/* Background Loop Video */}
      <div className="login-video-container">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="login-video-element"
          poster="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920"
        >
          <source
            src="https://assets.mixkit.co/videos/preview/mixkit-news-room-footage-4997-large.mp4"
            type="video/mp4"
          />
        </video>
        <div className="login-dark-overlay"></div>
      </div>

      {/* Decorative Orbs */}
      <div className="login-decor-container">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      {/* Login Portal Card */}
      <div className="login-content-wrapper">
        <div className="login-glass-card">
          <div className="login-card-header">
            <div className="login-logo-circle">
              <svg className="login-logo-svg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h1 className="login-brand-title">
              THE <span className="highlight-brand">MERIDIAN</span>
            </h1>
            <p className="login-subtitle">
              {isLogin ? 'Welcome back, please sign in to continue' : 'Create your account to get started'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-element">
            {!isLogin && (
              <div className="login-field-group">
                <label className="login-field-label">Full Name</label>
                <div className="login-input-wrapper">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="login-input-field"
                    placeholder="John Doe"
                    required
                  />
                  <div className="login-input-icon">👤</div>
                </div>
              </div>
            )}

            <div className="login-field-group">
              <label className="login-field-label">Email Address</label>
              <div className="login-input-wrapper">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input-field"
                  placeholder="you@example.com"
                  required
                />
                <div className="login-input-icon">✉️</div>
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-field-label">Password</label>
              <div className="login-input-wrapper">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input-field"
                  placeholder="••••••••"
                  required
                />
                <div className="login-input-icon">🔒</div>
              </div>
            </div>

            {!isLogin && (
              <div className="login-field-group">
                <label className="login-field-label">Confirm Password</label>
                <div className="login-input-wrapper">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-input-field"
                    placeholder="••••••••"
                    required
                  />
                  <div className="login-input-icon">🛡️</div>
                </div>
              </div>
            )}

            <div className="login-extra-row">
              <label className="login-checkbox-label">
                <input type="checkbox" className="login-checkbox-input" />
                <span className="login-checkbox-text">Remember me</span>
              </label>
              <a href="#" className="login-forgot-link" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>

            <button type="submit" className="login-submit-button">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="login-toggle-container">
            <p className="login-toggle-text">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="login-toggle-btn"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="login-divider-row">
            <div className="login-divider-line"></div>
            <span className="login-divider-text">Or continue with</span>
            <div className="login-divider-line"></div>
          </div>

          <div className="login-social-container">
            <div ref={googleButtonRef} className="google-auth-element-container"></div>
          </div>
        </div>

        <p className="login-footer-text">
          © {new Date().getFullYear()} The Meridian. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
