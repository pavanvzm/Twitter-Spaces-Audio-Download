/**
 * Cache Service
 * 
 * Simple in-memory cache with TTL support.
 * For production, use Redis with ioredis.
 */

const cache = new Map();

/**
 * Get a value from cache
 */
export async function cacheGet(key) {
  const entry = cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  // Check expiration
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return entry.value;
}

/**
 * Set a value in cache
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  });
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export async function cacheClear() {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function cacheStats() {
  const now = Date.now();
  let valid = 0;
  let expired = 0;
  
  for (const entry of cache.values()) {
    if (entry.expiresAt > now) {
      valid++;
    } else {
      expired++;
    }
  }
  
  return {
    total: cache.size,
    valid,
    expired,
  };
}

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}, 60000); // Every minute
