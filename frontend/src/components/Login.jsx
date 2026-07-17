import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import SpecularButton from './SpecularButton';

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' }); // type: 'error'|'success'|'info'
  const googleButtonRef = useRef(null);

  const GOOGLE_CLIENT_ID = '572065042143-j3ilmq1fmb2q44rik34dq8ci9d1pb1q2.apps.googleusercontent.com';

  useEffect(() => {
    const initGSI = () => {
      if (window.google?.accounts && googleButtonRef.current) {
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
          });
        } catch (err) {
          console.error('Google Sign-In init error:', err);
        }
      }
    };
    if (window.google?.accounts) {
      initGSI();
    } else {
      const t = setInterval(() => {
        if (window.google?.accounts) { initGSI(); clearInterval(t); }
      }, 100);
      return () => clearInterval(t);
    }
  }, [mode]);

  const handleGoogleCallback = (response) => {
    try {
      const payload = parseJwt(response.credential);
      if (payload) {
        onLogin({ name: payload.name, email: payload.email, avatar: payload.picture });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Google sign-in failed. Please try again.' });
    }
  };

  const parseJwt = (token) => {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')));
    } catch { return null; }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Check if user exists in DB
      const res = await fetch(`${API_BASE_URL}/api/auth/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!data.exists) {
        // No account found — tell them to sign up
        setMessage({
          type: 'warn',
          text: `No account found for "${email}". Please sign up first to create your account.`
        });
        setIsLoading(false);
        return;
      }

      // Account found — log in directly
      onLogin({
        name: data.user?.name || email.split('@')[0],
        email: email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user?.name || email)}&background=3b82f6&color=fff&size=100`
      });
    } catch (err) {
      // Backend unavailable — allow login with local session
      onLogin({
        name: email.split('@')[0],
        email: email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=3b82f6&color=fff&size=100`
      });
    }
    setIsLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // First check if email already exists
      const checkRes = await fetch(`${API_BASE_URL}/api/auth/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const checkData = await checkRes.json();

      if (checkData.exists) {
        setMessage({ type: 'error', text: 'An account already exists with this email. Please sign in instead.' });
        setIsLoading(false);
        return;
      }

      // Register new user
      const signupRes = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      });
      const signupData = await signupRes.json();

      if (signupData.error) {
        setMessage({ type: 'error', text: signupData.error });
        setIsLoading(false);
        return;
      }

      // Success — log them in
      setMessage({ type: 'success', text: 'Account created successfully! Logging you in...' });
      setTimeout(() => {
        onLogin({
          name: name,
          email: email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=100`
        });
      }, 800);
    } catch (err) {
      // Backend unavailable — register locally
      onLogin({
        name: name,
        email: email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=100`
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="login-page-container">
      {/* Background Video */}
      <div className="login-video-container">
        <video autoPlay loop muted playsInline className="login-video-element"
          poster="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920">
          <source src="https://assets.mixkit.co/videos/preview/mixkit-news-room-footage-4997-large.mp4" type="video/mp4" />
        </video>
        <div className="login-dark-overlay"></div>
      </div>

      {/* Decorative Orbs */}
      <div className="login-decor-container">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>
      </div>

      {/* Login Card */}
      <div className="login-content-wrapper">
        <div className="login-glass-card">
          <div className="login-card-header">
            <div className="login-logo-circle">
              <svg className="login-logo-svg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h1 className="login-brand-title">TRUTH <span className="highlight-brand">LENS</span></h1>
            <p className="login-subtitle">
              {mode === 'login' ? 'Welcome back — sign in to continue' : 'Create your account to get started'}
            </p>
          </div>

          {/* Alert Message */}
          {message.text && (
            <div className={`auth-message auth-message-${message.type}`}>
              <span className="auth-message-icon">
                {message.type === 'error' ? '❌' : message.type === 'warn' ? '⚠️' : '✅'}
              </span>
              <span>{message.text}</span>
              {message.type === 'warn' && (
                <button className="auth-message-action" onClick={() => { setMode('signup'); setMessage({ type: '', text: '' }); }}>
                  Sign Up Now →
                </button>
              )}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="login-form-element">
            {mode === 'signup' && (
              <div className="login-field-group">
                <label className="login-field-label">Full Name</label>
                <div className="login-input-wrapper">
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="login-input-field" placeholder="John Doe" required />
                  <div className="login-input-icon">👤</div>
                </div>
              </div>
            )}

            <div className="login-field-group">
              <label className="login-field-label">Email Address</label>
              <div className="login-input-wrapper">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="login-input-field" placeholder="you@example.com" required />
                <div className="login-input-icon">✉️</div>
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-field-label">Password</label>
              <div className="login-input-wrapper">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="login-input-field" placeholder="••••••••" required />
                <div className="login-input-icon">🔒</div>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="login-field-group">
                <label className="login-field-label">Confirm Password</label>
                <div className="login-input-wrapper">
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="login-input-field" placeholder="••••••••" required />
                  <div className="login-input-icon">🛡️</div>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="login-extra-row">
                <label className="login-checkbox-label">
                  <input type="checkbox" className="login-checkbox-input" />
                  <span className="login-checkbox-text">Remember me</span>
                </label>
                <a href="#" className="login-forgot-link" onClick={e => e.preventDefault()}>Forgot password?</a>
              </div>
            )}

            <SpecularButton
              type="submit"
              className="login-submit-button"
              disabled={isLoading}
              size="md"
              radius={12}
              tint="#c41e3a"
              tintOpacity={1}
              textColor="#ffffff"
              lineColor="#ffffff"
              baseColor="#9d172d"
              intensity={1.2}
              thickness={1.5}
              followMouse={true}
              proximity={180}
            >
              {isLoading ? (
                <span className="login-spinner">⏳ {mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </SpecularButton>
          </form>

          <div className="login-toggle-container">
            <p className="login-toggle-text">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage({ type: '', text: '' }); }}
                className="login-toggle-btn">
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
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

        <p className="login-footer-text">© {new Date().getFullYear()} Truth Lens. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Login;
