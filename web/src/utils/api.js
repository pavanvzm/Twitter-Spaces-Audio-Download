/**
 * API Utility
 * 
 * Simple Axios instance for guest mode - no authentication required.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 429 - rate limited
    if (error.response?.status === 429) {
      console.warn('Rate limited. Please wait before trying again.');
    }
    return Promise.reject(error);
  }
);

export default api;
