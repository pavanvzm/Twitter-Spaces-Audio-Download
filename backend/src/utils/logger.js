/**
 * Logger Utility
 * 
 * Structured logging with levels and optional JSON output.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  // Remove sensitive fields
  delete logEntry.accessToken;
  delete logEntry.refreshToken;
  delete logEntry.password;
  delete logEntry.token;
  
  // Sanitize any tokens in nested objects
  if (logEntry.data && typeof logEntry.data === 'object') {
    for (const key of Object.keys(logEntry.data)) {
      if (/token|secret|key|password/i.test(key)) {
        logEntry.data[key] = '[REDACTED]';
      }
    }
  }

  return process.env.LOG_FORMAT === 'json' 
    ? JSON.stringify(logEntry)
    : `[${timestamp}] [${level.toUpperCase()}] ${message}${Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : ''}`;
}

export const logger = {
  error(message, ...meta) {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta[0]));
    }
  },

  warn(message, ...meta) {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta[0]));
    }
  },

  info(message, ...meta) {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta[0]));
    }
  },

  debug(message, ...meta) {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta[0]));
    }
  },
};
