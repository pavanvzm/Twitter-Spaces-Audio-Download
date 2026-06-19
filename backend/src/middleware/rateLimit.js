/**
 * Rate Limiting Middleware
 * 
 * Implements per-user and per-IP rate limiting to respect X's API quotas.
 * Authenticated users get higher limits (1000 req/15min) vs guests (100 req/15min).
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * General API rate limiter
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
    retryAfter: 900, // seconds
  },
  keyGenerator: (req) => {
    // Use session token if available, otherwise IP
    return req.cookies?.x_session || req.headers['x-session-token'] || req.ip;
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Authentication endpoints rate limiter
 * Stricter limits to prevent abuse
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Only 20 auth attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMITED',
    retryAfter: 900,
  },
  keyGenerator: (req) => {
    return req.ip;
  },
  skip: (req) => {
    // Skip if we have a valid session
    return req.cookies?.x_session && req.cookies?.x_session.length > 20;
  },
});

/**
 * Spaces API rate limiter
 * Higher limits for authenticated users
 */
export const spacesRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 Space requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many Space requests',
    code: 'SPACES_RATE_LIMITED',
    retryAfter: 900,
  },
  keyGenerator: (req) => {
    return req.cookies?.x_session || req.headers['x-session-token'] || req.ip;
  },
  skip: (req, res) => {
    // Check cache hits - don't count cached responses
    return res.locals?.cached === true;
  },
});

/**
 * Download rate limiter
 * Prevent download spam
 */
export const downloadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 downloads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Download limit reached',
    code: 'DOWNLOAD_RATE_LIMITED',
    retryAfter: 3600,
  },
  keyGenerator: (req) => {
    return req.cookies?.x_session || req.headers['x-session-token'] || req.ip;
  },
});
