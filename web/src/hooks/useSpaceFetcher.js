/**
 * Browser-Based Twitter Spaces Fetcher
 * 
 * This hook fetches Space data directly from Twitter using the browser's
 * authentication. This is necessary because X blocks server-side API access.
 */

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

/**
 * GraphQL query to fetch Space metadata
 */
const AUDIO_SPACE_QUERY = `
  query AudioSpaceById($id: ID!) {
    audioSpace(id: $id) {
      metadata {
        restId
        title
        state
        startedAt
        endedAt
        updatedAt
        liveArchiveUrl
        RestrictSpacesRecordingSettings
      }
      creators {
        users {
          results {
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
            results {
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
      restoredBroadcast {
        restId
        title
        startedAt
        endedAt
        liveArchiveUrl
      }
    }
  }
`;

/**
 * GraphQL query ID for AudioSpaceById
 * This is the operation hash from Twitter's client
 */
const QUERY_ID = 'zMbdEMdMLmsp0ZHRV6yH9g';

/**
 * Hook to fetch Space data from Twitter
 */
export function useSpaceFetcher() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch Space metadata directly from Twitter using browser fetch
   * This uses the user's authenticated session from the browser
   */
  const fetchSpace = useCallback(async (spaceId) => {
    setLoading(true);
    setError(null);

    try {
      // Twitter's internal API endpoint
      const url = `https://twitter.com/i/api/graphql/${QUERY_ID}/AudioSpaceById`;

      // Build the query
      const query = {
        queryId: QUERY_ID,
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

      // Make the request with browser credentials
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8x7P7V2m4m8X5Rt3Nj9K3ayPIBuXrsICpwz3pY3TxqCQWE3mX2VnAEVcpLVu9k0vBBxNw7Y2kxLEQqSptZkEDXLwhr3GV3FCb8J6g6w1X6V2nB9p40f5Qq7s3u7dP4TJJHY4V5QO8p3v1O6p5x7j9Q3F8q2h5g4j0z1m2p3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8',
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'Referer': 'https://twitter.com/',
          'Origin': 'https://twitter.com',
        },
        body: JSON.stringify(query),
        credentials: 'include', // Important: include cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not logged in to X. Please log in at twitter.com first.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. This Space may be private.');
        }
        if (response.status === 404) {
          throw new Error('Space not found.');
        }
        throw new Error(`X API error: ${response.status}`);
      }

      const data = await response.json();

      // Check for GraphQL errors
      if (data.errors && data.errors.length > 0) {
        const errorMsg = data.errors[0].message || 'GraphQL error';
        if (errorMsg.includes('invalid')) {
          throw new Error('This Space ID is invalid.');
        }
        throw new Error(errorMsg);
      }

      // Extract the Space data
      const space = data?.data?.audioSpace;
      if (!space) {
        throw new Error('Could not find Space data.');
      }

      // Parse into our format
      return parseSpaceData(space);

    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch Space';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Alternative: Fetch Space info by scraping the public page
   * This works for public Spaces without login
   */
  const fetchSpaceFromPage = useCallback(async (spaceId) => {
    setLoading(true);
    setError(null);

    try {
      // Try to fetch the Space page directly
      const response = await fetch(`https://twitter.com/i/spaces/${spaceId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Space page: ${response.status}`);
      }

      const html = await response.text();

      // Look for embedded JSON data
      const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      
      if (jsonMatch) {
        const nextData = JSON.parse(jsonMatch[1]);
        
        // Navigate the complex structure
        const spaceData = nextData.props?.pageProps?.audioSpace;
        if (spaceData) {
          return parseSpaceData(spaceData);
        }
      }

      // Fallback: try to find stream URL in page
      const streamMatch = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
      if (streamMatch) {
        return {
          id: spaceId,
          title: extractTitle(html) || `Space ${spaceId}`,
          status: 'ended',
          streamUrl: streamMatch[1],
          host: extractHostInfo(html),
        };
      }

      throw new Error('Could not extract Space data from page.');
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch Space';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    fetchSpace,
    fetchSpaceFromPage,
    loading,
    error,
  };
}

/**
 * Parse Space data into our standard format
 */
function parseSpaceData(space) {
  const metadata = space.metadata || {};
  const rest = space.restoredBroadcast || {};
  const creators = space.creators?.users?.results || [];
  const participants = space.participants || {};

  const host = creators[0] || {};

  return {
    id: metadata.restId || rest?.restId || space.restoredBroadcastId,
    title: metadata.title || rest?.title || 'Untitled Space',
    status: mapSpaceState(metadata.state),
    streamUrl: metadata.liveArchiveUrl || rest?.liveArchiveUrl,
    host: {
      id: host.id || '',
      name: host.name || 'Unknown',
      username: host.screen_name || host.name || 'unknown',
      avatarUrl: host.profile_image_url || '',
    },
    duration: calculateDuration(
      metadata.startedAt || rest?.startedAt,
      metadata.endedAt || rest?.endedAt
    ),
    startedAt: metadata.startedAt || rest?.startedAt,
    endedAt: metadata.endedAt || rest?.endedAt,
    participantCount: participants.listeners?.count || 0,
    speakers: participants.speakers?.users?.results?.map(u => ({
      id: u.id,
      name: u.name,
      username: u.screen_name,
      avatarUrl: u.profile_image_url,
    })) || [],
  };
}

/**
 * Map X state to our format
 */
function mapSpaceState(state) {
  const stateMap = {
    'SpaceStatus.NotStarted': 'scheduled',
    'SpaceStatus.Live': 'live',
    'SpaceStatus.LiveEnded': 'ended',
    'SpaceStatus.Ended': 'ended',
    'Ended': 'ended',
    'Live': 'live',
    'live': 'live',
    'ended': 'ended',
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
 * Extract title from HTML
 */
function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  if (match) {
    return match[1].replace(/\s*[-|]\s*(Twitter|X)\s*$/, '').trim();
  }
  return null;
}

/**
 * Extract host info from HTML
 */
function extractHostInfo(html) {
  const nameMatch = html.match(/"author":\s*{[^}]*"name":\s*"([^"]+)"/) ||
                    html.match(/"creator":\s*{[^}]*"name":\s*"([^"]+)"/);
  const usernameMatch = html.match(/@([a-zA-Z0-9_]+)/);
  
  return {
    name: nameMatch?.[1] || 'Unknown',
    username: usernameMatch?.[1] || 'unknown',
    avatarUrl: '',
  };
}

export default useSpaceFetcher;
