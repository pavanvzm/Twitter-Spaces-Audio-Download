/**
 * Spaces Routes - Internal Endpoint Access
 * 
 * Former X Staff Engineering Insight:
 * This module handles the internal GraphQL queries used by X's frontend
 * to fetch Space metadata and audio stream URLs. The public v2 API has
 * severe rate limits, but authenticated requests to the internal endpoints
 * used by the web client have much higher quotas per user.
 * 
 * Key Insight: X uses HLS (HTTP Live Streaming) for Space audio delivery.
 * The .m3u8 manifest contains references to AAC audio segments stored on
 * X's CDN (video.twimg.com and internal clusters).
 */

import express from 'express';
import { fetchSpaceMetadata, fetchSpaceAudioUrl, getAuthenticatedClient } from '../services/twitter.js';
import { getSessionByToken } from '../services/session.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { logger } from '../utils/logger.js';
import { spacesRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Internal GraphQL query for Space by ID
// This mimics what the web client sends
const AUDIO_SPACE_BY_ID_QUERY = `
  query AudioSpaceById($id: ID!) {
    audioSpace(id: $id) {
      metadata {
        liveArchiveUrl
        endedAt
        startedAt
        state
        title
        updatedAt
        RestrictSpacesRecordingSettings
      }
      creators {
        users {
          result {
            id
            name
            screen_name
            profile_image_url
          }
        }
      }
      participants {
        speakers {
          users {
            result {
              id
              name
              screen_name
              profile_image_url
            }
          }
        }
        listeners {
          count
        }
      }
    }
  }
`;

/**
 * GET /api/spaces/:id
 * Fetch Space metadata using guest token (no auth required for public Spaces)
 * 
 * This endpoint uses the internal GraphQL API that the web client uses,
 * which works with just a guest token for public Space data.
 */
router.get('/:id', spacesRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check cache (5 minute TTL)
    const cacheKey = `space:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch from X's internal API using guest token
    const metadata = await fetchSpaceMetadata(null, id);
    
    if (!metadata) {
      return res.status(404).json({
        error: 'Space not found or not accessible',
        code: 'SPACE_NOT_FOUND'
      });
    }

    // Cache the result
    await cacheSet(cacheKey, metadata, 300); // 5 minutes

    logger.info(`Space fetched (guest): ${id} (@${metadata.host?.username})`);

    res.json(metadata);
  } catch (error) {
    logger.error(`Space fetch error for ${req.params.id}:`, error);
    
    if (error.status === 401 || error.status === 403) {
      return res.status(401).json({
        error: 'Access denied - this Space may be private',
        code: 'ACCESS_DENIED'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter: error.retryAfter || 60
      });
    }

    res.status(500).json({
      error: 'Failed to fetch Space',
      code: 'FETCH_FAILED'
    });
  }
});

/**
 * GET /api/spaces/:id/audio
 * Get the HLS audio URL for a Space using guest token
 * 
 * This returns the .m3u8 manifest URL that can be used to download
 * the audio segments. Works for ended Spaces with recordings.
 */
router.get('/:id/audio', spacesRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the audio URL from X's internal API using guest token
    const audioData = await fetchSpaceAudioUrl(null, id);
    
    if (!audioData) {
      return res.status(404).json({
        error: 'Audio not available for this Space',
        code: 'AUDIO_UNAVAILABLE',
        details: 'The Space may still be live, restricted, or requires login'
      });
    }

    res.json({
      success: true,
      audioUrl: audioData.audioUrl,
      duration: audioData.duration,
      format: 'hls',
      expiresAt: audioData.expiresAt,
    });
  } catch (error) {
    logger.error(`Audio URL fetch error for ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to get audio URL',
      code: 'AUDIO_FETCH_FAILED'
    });
  }
});

/**
 * POST /api/spaces/parse
 * Parse a Space URL and extract the Space ID
 * 
 * Supports various X Space URL formats:
 * - https://twitter.com/i/spaces/1RDxlkAORPVJL
 * - https://twitter.com/username/status/123/spaces (retweet)
 * - https://x.com/i/spaces/1RDxlkAORPVJL
 */
router.post('/parse', spacesRateLimiter, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'URL_REQUIRED'
      });
    }

    // Parse various Space URL formats
    const spaceId = parseSpaceUrl(url);
    
    if (!spaceId) {
      return res.status(400).json({
        error: 'Invalid Space URL format',
        code: 'INVALID_URL',
        supportedFormats: [
          'https://twitter.com/i/spaces/1RDxlkAORPVJL',
          'https://x.com/i/spaces/1RDxlkAORPVJL'
        ]
      });
    }

    res.json({
      success: true,
      spaceId,
      normalizedUrl: `https://twitter.com/i/spaces/${spaceId}`
    });
  } catch (error) {
    logger.error('URL parse error:', error);
    res.status(500).json({
      error: 'Failed to parse URL',
      code: 'PARSE_FAILED'
    });
  }
});

/**
 * Parse Space URL to extract Space ID
 */
function parseSpaceUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // Direct Space URL: /i/spaces/:id
    const spacesMatch = urlObj.pathname.match(/\/i\/spaces\/([A-Za-z0-9]+)/);
    if (spacesMatch) {
      return spacesMatch[1];
    }
    
    // Status with Space: /:username/status/:tweetId/spaces
    const statusSpacesMatch = urlObj.pathname.match(/\/status\/\d+\/spaces/);
    if (statusSpacesMatch) {
      // Would need additional API call to get Space ID
      // For now, return null - implement if needed
      return null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * GET /api/spaces/search
 * Search for Spaces (basic implementation)
 * Note: X doesn't have a public search API for Spaces,
 * this would require internal endpoints
 */
router.get('/search/:query', spacesRateLimiter, async (req, res) => {
  try {
    const { query } = req.params;
    const sessionToken = req.cookies?.x_session || req.headers['x-session-token'];
    
    const client = await getAuthenticatedClient(sessionToken);
    if (!client) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // This is a placeholder - real implementation would use
    // X's internal search API which is not publicly documented
    logger.warn(`Space search requested: ${query} - not implemented`);

    res.json({
      spaces: [],
      message: 'Space search via API is limited. Try entering a direct Space URL.'
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      code: 'SEARCH_FAILED'
    });
  }
});

export default router;
