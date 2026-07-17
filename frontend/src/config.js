const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
export const API_BASE_URL = process.env.REACT_APP_API_URL || (isProd ? 'https://meridian-news-backend.onrender.com' : 'http://localhost:5000');
