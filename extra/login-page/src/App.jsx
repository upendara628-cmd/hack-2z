import React, { useState, useEffect, useRef } from 'react'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const googleButtonRef = useRef(null)

  // Replace with your actual Google Client ID from Google Cloud Console
  const GOOGLE_CLIENT_ID = '572065042143-j3ilmq1fmb2q44rik34dq8ci9d1pb1q2.apps.googleusercontent.com'

  useEffect(() => {
    // Initialize Google Sign-In when script loads
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts && googleButtonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback,
            auto_select: false,
          })

          // Render the Google Sign-In button
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: '100%',
          })
        } catch (error) {
          console.error('Google Sign-In initialization error:', error)
        }
      }
    }

    // Check if Google is already loaded
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn()
    } else {
      // Wait for Google script to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google && window.google.accounts) {
          initializeGoogleSignIn()
          clearInterval(checkGoogleLoaded)
        }
      }, 100)

      return () => clearInterval(checkGoogleLoaded)
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isLogin) {
      console.log('Login attempt:', { email, password })
    } else {
      console.log('Signup attempt:', { name, email, password })
    }
  }

  const handleGoogleCallback = (response) => {
    console.log('Google login success:', response)
    // Decode the JWT token to get user info
    const payload = parseJwt(response.credential)
    console.log('User info:', payload)
    
    // Here you would typically send the credential to your backend
    // For demo purposes, we'll just log the user info
    alert(`Successfully logged in as ${payload.name} (${payload.email})`)
  }

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (e) {
      console.error('Error parsing JWT:', e)
      return null
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920"
        >
          <source
            src="https://assets.mixkit.co/videos/preview/mixkit-news-room-footage-4997-large.mp4"
            type="video/mp4"
          />
        </video>
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80"></div>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse-slow-delayed"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-3xl animate-float"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
            {/* Logo/Brand */}
            <div className="text-center mb-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h- rounded-full bg-gradient-to-br from-amber-400 to-amber-600 mb-4 animate-scale-in">
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                News<span className="text-amber-400">Portal</span>
              </h1>
              <p className="text-gray-300 text-sm">
                {isLogin ? 'Welcome back, please sign in to continue' : 'Create your account to get started'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="animate-slide-in" style={{ animationDelay: '0.05s' }}>
                  <label htmlFor="name" className="block text-sm font-medium text-amber-400 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all duration-300 backdrop-blur-sm"
                      placeholder="John Doe"
                      required
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              <div className="animate-slide-in" style={{ animationDelay: isLogin ? '0.1s' : '0.1s' }}>
                <label htmlFor="email" className="block text-sm font-medium text-amber-400 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all duration-300 backdrop-blur-sm"
                    placeholder="you@example.com"
                    required
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="animate-slide-in" style={{ animationDelay: isLogin ? '0.2s' : '0.15s' }}>
                <label htmlFor="password" className="block text-sm font-medium text-amber-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all duration-300 backdrop-blur-sm"
                    placeholder="••••••••"
                    required
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                  </div>
                </div>
              </div>
              {!isLogin && (
                <div className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-amber-400 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all duration-300 backdrop-blur-sm"
                      placeholder="••••••••"
                      required
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between animate-slide-in" style={{ animationDelay: '0.3s' }}>
                <label className="flex items-center cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-500 bg-white/10 text-amber-400 focus:ring-amber-400 focus:ring-offset-0 transition-all" />
                  <span className="ml-2 text-sm text-gray-300 group-hover:text-amber-400 transition-colors">Remember me</span>
                </label>
                <a href="#" className="text-sm text-amber-400 hover:text-amber-300 transition-colors duration-300">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold py-4 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black animate-slide-in"
                style={{ animationDelay: '0.4s' }}
              >
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 text-center animate-slide-in" style={{ animationDelay: '0.5s' }}>
              <p className="text-gray-400">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-amber-400 hover:text-amber-300 transition-colors duration-300 font-medium cursor-pointer"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>

            {/* Social Login */}
            <div className="mt-6 animate-slide-in" style={{ animationDelay: '0.6s' }}>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <div 
                  ref={googleButtonRef}
                  className="w-full flex items-center justify-center"
                ></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-500 text-xs mt-6 animate-fade-in">
            © 2024 NewsPortal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
