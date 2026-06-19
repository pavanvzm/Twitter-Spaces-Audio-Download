/**
 * Error Handler Middleware
 * 
 * Centralized error handling with proper logging and sanitized responses.
 */

import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log the error (don't log sensitive data)
  const errorInfo = {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url.replace(/[?&]token=[^&]*/g, '').replace(/[?&]access_token=[^&]*/g, ''),
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  };
  
  if (err.status === 401 || err.status === 403) {
    logger.warn('Auth error:', errorInfo);
  } else {
    logger.error('Request error:', errorInfo);
  }

  // Don't expose internal errors to clients
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  // Sanitize error messages for production
  const message = process.env.NODE_ENV === 'production'
    ? (status < 500 ? err.message : 'An unexpected error occurred')
    : err.message;

  res.status(status).json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
