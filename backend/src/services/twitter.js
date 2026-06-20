/**
 * Twitter API Service
 * 
 * Former X Staff Engineering Insight:
 * The key to reliable Space access is understanding how X's client apps
 * communicate with backend services. The web client uses:
 * 
 * 1. A Bearer token (app-level, public)
 * 2. A guest token (ephemeral, obtained via /guest/activate)
 * 3. User authentication tokens (OAuth tokens)
 * 
 * For authenticated Space downloads, we need:
 * - A valid user access_token (OAuth 2.0)
 * - The guest token mechanism for certain endpoints
 * - Proper User-Agent and headers that match the web client
 * 
 * The internal API uses GraphQL extensively. The Space metadata comes from
 * the AudioSpace GraphQL type which contains all the juicy details including
 * the HLS manifest URL in metadata.liveArchiveUrl.
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// X API Base URLs
const API_BASE = 'https://api.twitter.com';
const WEB_API_BASE = 'https://twitter.com/i/api';

// Internal Bearer token (public, used for guest access)
const BEARER_TOKEN = process.env.X_BEARER_TOKEN || 
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8x7H7Y' + 
  '3mXqK2JKZ6U9mO4b3T3q7a7q7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Qa7Q';

// Guest token pool for rotation (better rate limit distribution)
const guestTokenPool = {
  tokens: [],
  lastRefresh: 0,
  refreshInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  maxTokens: 3,
};

/**
 * Get a fresh guest token from the pool
 * Maintains multiple tokens for better rate limit distribution
 */
export async function getGuestToken() {
  const now = Date.now();
  
  // Refresh pool if needed
  if (now - guestTokenPool.lastRefresh > guestTokenPool.refreshInterval) {
    await refreshGuestTokenPool();
  }
  
  // Return an available token or get a new one
  if (guestTokenPool.tokens.length > 0) {
    return guestTokenPool.tokens[0];
  }
  
  return await acquireGuestToken();
}

/**
 * Refresh the entire guest token pool
 */
async function refreshGuestTokenPool() {
  logger.info('Refreshing guest token pool...');
  
  const newTokens = [];
  for (let i = 0; i < guestTokenPool.maxTokens; i++) {
    try {
      const token = await acquireGuestToken();
      newTokens.push(token);
    } catch (error) {
      logger.warn(`Failed to acquire guest token ${i}: ${error.message}`);
    }
  }
  
  guestTokenPool.tokens = newTokens;
  guestTokenPool.lastRefresh = Date.now();
  
  logger.info(`Guest token pool refreshed: ${newTokens.length} tokens`);
}

/**
 * Acquire a single guest token from X
 */
async function acquireGuestToken() {
  try {
    const response = await fetch(`${API_BASE}/1.1/guest/activate.json`, {
      method: 'POST',
      headers: getBaseHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error(`Guest token failed: ${response.status} - ${text.substring(0, 200)}`);
      throw new Error(`Guest token failed: ${response.status}`);
    }

    const data = await response.json();
    return data.guest_token;
  } catch (error) {
    logger.error('Failed to acquire guest token:', error);
    throw error;
  }
}

/**
 * Get authenticated client for a user
 */
export async function getAuthenticatedClient(sessionToken) {
  // This would look up the session in a real implementation
  // For now, we'll handle it in the routes
  return { accessToken: sessionToken, authenticated: true };
}

/**
 * Get user profile using OAuth token
 */
export async function getUserProfile(accessToken) {
  try {
    const response = await fetch(`${API_BASE}/2/users/me`, {
      headers: {
        ...getBaseHeaders(),
        'Authorization': `Bearer ${accessToken}`,
      },
      params: {
        'user.fields': 'profile_image_url,description',
      },
    });

    if (!response.ok) {
      throw new Error(`User profile failed: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
      avatarUrl: data.data.profile_image_url,
      description: data.data.description,
    };
  } catch (error) {
    logger.error('Get user profile error:', error);
    throw error;
  }
}

/**
 * Validate an access token
 */
export async function validateToken(accessToken) {
  try {
    const response = await fetch(`${API_BASE}/2/users/me`, {
      headers: {
        ...getBaseHeaders(),
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Revoke an access token
 */
export async function revokeToken(accessToken) {
  try {
    const response = await fetch(`${API_BASE}/2/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token',
        client_id: process.env.X_CLIENT_ID,
      }),
    });

    return response.ok;
  } catch (error) {
    logger.error('Revoke token error:', error);
    return false;
  }
}

// Query IDs for GraphQL endpoints - these are periodically rotated by X
// The underscore version is the current stable query
const QUERY_IDS = {
  AUDIO_SPACE_BY_ID: 'zMbdEMdMLmsp0ZHRV6yH9g', // AudioSpaceById
  AUDIO_SPACE: '4bwfc0Ck6BZEO8Jjg3bUWQ', // AudioSpace (for live)
};

/**
 * Fetch Space metadata using internal GraphQL API
 * 
 * Former X Insight: The AudioSpaceById query returns the complete Space object
 * including the all-important liveArchiveUrl which points to the HLS manifest.
 * For live Spaces, you'd use AudioSpace instead.
 */
export async function fetchSpaceMetadata(accessToken, spaceId) {
  const guestToken = await getGuestToken();
  const queryId = QUERY_IDS.AUDIO_SPACE_BY_ID;

  const query = {
    queryId,
    variables: {
      id: spaceId,
      isMetatagsQuery: false,
      withDownvotePerspective: false,
      withReactionsMetadata: false,
      withReactionsPerspective: false,
      withScheduledSpaces: false,
      withSuperFollowsRelationshipFields: false,
    },
    features: {
      spaces_2022_h2_spaces_communities: false,
      dont_mention_me_view_api_enabled: false,
      interactive_text_enabled: false,
      responsive_web_graphql_exclude_protected_error_category: true,
      responsive_web_graphql_skip_user_profile_image_extensions: false,
      responsive_web_graphql_timeline_navigation_enabled: false,
      standardize_lcase_media_in_cards: false,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
      view_counts_everywhere_api_enabled: false,
    },
  };

  try {
    logger.info(`Fetching metadata for Space: ${spaceId}`);
    
    const response = await fetch(
      `${WEB_API_BASE}/graphql/${queryId}/AudioSpaceById`,
      {
        method: 'POST',
        headers: {
          ...getInternalHeaders(guestToken),
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
        },
        body: JSON.stringify(query),
      }
    );

    if (response.status === 401) {
      const error = new Error('Unauthorized - Space may be private');
      error.status = 401;
      throw error;
    }

    if (response.status === 403) {
      const error = new Error('Access denied - authentication required');
      error.status = 403;
      throw error;
    }

    if (response.status === 429) {
      const error = new Error('Rate limited by X API');
      error.status = 429;
      error.retryAfter = 60;
      throw error;
    }

    if (!response.ok) {
      const text = await response.text();
      logger.error(`GraphQL failed: ${response.status} - ${text.substring(0, 200)}`);
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      logger.warn('GraphQL errors:', JSON.stringify(data.errors));
      // Check if it's a query ID error (indicates rotation needed)
      const queryIdError = data.errors.find(e => e.message?.includes('queryId') || e.message?.includes('Unexpected'));
      if (queryIdError) {
        const error = new Error('X API query ID has expired - needs update');
        error.code = 'QUERY_ID_EXPIRED';
        throw error;
      }
    }

    const space = data?.data?.audioSpace;
    if (!space) {
      logger.warn(`No audioSpace found for ID: ${spaceId}`);
      return null;
    }

    // Parse the response into our format
    return parseSpaceResponse(space);
  } catch (error) {
    logger.error('Fetch Space metadata error:', error.message);
    throw error;
  }
}

/**
 * Parse GraphQL Space response into our format
 */
function parseSpaceResponse(space) {
  const metadata = space.metadata || {};
  const creators = space.creators?.users?.results || [];
  const participants = space.participants || {};
  const rest = space.restoredBroadcast || {};

  const host = creators[0] || {};

  // Extract the actual broadcast/restored data
  const broadcastData = rest || metadata;
  
  // The liveArchiveUrl is the key - this is the HLS manifest URL
  const streamUrl = metadata.liveArchiveUrl || 
                    broadcastData.liveArchiveUrl ||
                    broadcastData.audioSpaceMetadata?.liveArchiveUrl;

  return {
    id: metadata.restoredBroadcastId || 
        rest?.restoredBroadcastId || 
        space.restoredBroadcastId ||
        metadata.creator?.restoredBroadcastId,
    title: metadata.title || 
           rest?.title || 
           broadcastData.title || 
           'Untitled Space',
    host: {
      id: host.id || '',
      name: host.name || 'Unknown Host',
      username: host.screen_name || host.username || '',
      avatarUrl: host.profile_image_url || '',
    },
    status: mapSpaceState(metadata.state),
    startedAt: metadata.startedAt || rest?.startedAt || null,
    endedAt: metadata.endedAt || rest?.endedAt || null,
    duration: calculateDuration(
      metadata.startedAt || rest?.startedAt, 
      metadata.endedAt || rest?.endedAt
    ),
    participantCount: (participants.listeners?.count || 0) + 
                       (participants.speakers?.users?.results?.length || 0),
    speakers: (participants.speakers?.users?.results || []).map(u => ({
      id: u.id,
      name: u.name,
      username: u.screen_name || u.username,
      avatarUrl: u.profile_image_url,
    })),
    listeners: {
      count: participants.listeners?.count || 0,
    },
    streamUrl: streamUrl,
    thumbnailUrl: metadata.imageUrl || null,
  };
}

/**
 * Map X Space state to our format
 */
function mapSpaceState(state) {
  const stateMap = {
    'SpaceStatus.NotStarted': 'scheduled',
    'SpaceStatus.Live': 'live',
    'SpaceStatus.Ended': 'ended',
    'SpaceStatus.Callback': 'ended',
  };
  return stateMap[state] || 'unknown';
}

/**
 * Calculate duration in seconds
 */
function calculateDuration(startedAt, endedAt) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.floor((end - start) / 1000);
}

/**
 * Fetch audio URL for a Space
 * Returns the HLS manifest URL
 */
export async function fetchSpaceAudioUrl(accessToken, spaceId) {
  // First get the metadata which contains the audio URL
  const metadata = await fetchSpaceMetadata(accessToken, spaceId);
  
  if (!metadata) {
    return null;
  }

  // For live Spaces, we need a different approach
  if (metadata.status === 'live') {
    // Live audio extraction is more complex
    // Would need to intercept the WebSocket stream
    return null;
  }

  // For ended Spaces with recordings
  if (metadata.streamUrl) {
    return {
      audioUrl: metadata.streamUrl,
      duration: metadata.duration,
      expiresAt: Date.now() + 60 * 60 * 1000, // URL typically valid for 1 hour
    };
  }

  return null;
}

/**
 * Get base HTTP headers
 */
function getBaseHeaders() {
  return {
    'Authorization': `Bearer ${BEARER_TOKEN}`,
    'User-Agent': getClientUserAgent(),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };
}

/**
 * Get headers for internal API calls
 */
function getInternalHeaders(guestToken) {
  return {
    ...getBaseHeaders(),
    'x-guest-token': guestToken || '',
    'Content-Type': 'application/json',
    'Referer': 'https://twitter.com/',
    'Origin': 'https://twitter.com',
  };
}

/**
 * Generate a client-like User-Agent
 */
function getClientUserAgent() {
  const versions = {
    windows: '10.0',
    mac: '10_15_7',
    chrome: '120.0.6099.130',
  };
  
  return `Mozilla/5.0 (Windows NT ${versions.windows}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${versions.chrome} Safari/537.36`;
}

/**
 * Generate a device ID for client identification
 */
export function generateDeviceId() {
  return crypto.randomUUID();
}
