/**
 * X Spaces Audio Downloader - Backend Proxy Service
 * 
 * Former Senior Staff Engineer at X, specializing in Audio Infrastructure.
 * This service handles authenticated requests to X's internal endpoints
 * for Space audio extraction, bypassing public API rate limits.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import spacesRoutes from './routes/spaces.js';
import downloadRoutes from './routes/download.js';
import apiRoutes from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/security.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.X_API_BASE || 'https://api.twitter.com'],
      mediaSrc: ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(securityHeaders);

// CORS configuration for web and mobile clients
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Version'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging with sensitive data filtering
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const sanitizedUrl = req.url.replace(/[?&]token=[^&]*/g, '').replace(/[?&]access_token=[^&]*/g, '');
    logger.info(`${req.method} ${sanitizedUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Rate limiting per IP and user
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api', apiRoutes);

// Serve static files from parent directory (for simple index.html)
app.use(express.static(join(__dirname, '../../')));

// Serve simple index.html for the main route
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../../index.html'));
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../web/dist')));
}

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`🚀 X Spaces Downloader Proxy running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
