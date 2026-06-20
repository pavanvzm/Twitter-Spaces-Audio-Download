/**
 * Browser-Based Twitter Spaces API
 * 
 * Uses the browser's existing Twitter authentication to fetch Space data.
 * This bypasses the need for server-side API access which X has blocked.
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Simple in-memory task storage
const downloadTasks = new Map();

/**
 * GET /api/space/:spaceId
 * Simple endpoint to get Space metadata
 */
router.get('/space/:spaceId', async (req, res) => {
  try {
    const { spaceId } = req.params;

    if (!spaceId) {
      return res.status(400).json({ error: 'Space ID is required' });
    }

    // For now, return mock data with a note
    // In production, this would call the Twitter GraphQL API
    logger.info(`Space info requested for: ${spaceId}`);

    res.json({
      id: spaceId,
      title: `Space ${spaceId.substring(0, 8)}...`,
      host: 'X Space Host',
      duration: 3600,
      participantCount: 0,
      status: 'unknown',
      note: 'Open this URL in a browser where you are logged into X to fetch real data'
    });
  } catch (error) {
    logger.error('Space info error:', error);
    res.status(500).json({ error: 'Failed to fetch Space info' });
  }
});

/**
 * POST /api/download
 * Start a download task
 */
router.post('/download', async (req, res) => {
  try {
    const { spaceId, format = 'mp3' } = req.body;

    if (!spaceId) {
      return res.status(400).json({ error: 'Space ID is required' });
    }

    const taskId = uuidv4();
    
    // Create a download task
    const task = {
      id: taskId,
      spaceId,
      format,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      error: null
    };

    downloadTasks.set(taskId, task);

    logger.info(`Download task created: ${taskId} for Space: ${spaceId}`);

    // Simulate download progress
    simulateProgress(taskId);

    res.json({
      success: true,
      taskId,
      message: 'Download started'
    });
  } catch (error) {
    logger.error('Download error:', error);
    res.status(500).json({ error: 'Failed to start download' });
  }
});

/**
 * Simulate download progress
 */
async function simulateProgress(taskId) {
  let progress = 0;
  
  const interval = setInterval(() => {
    const task = downloadTasks.get(taskId);
    if (!task) {
      clearInterval(interval);
      return;
    }

    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      task.progress = 100;
      task.status = 'completed';
      downloadTasks.set(taskId, task);
      clearInterval(interval);
      logger.info(`Download completed: ${taskId}`);
    } else {
      task.progress = Math.floor(progress);
      task.status = 'downloading';
      downloadTasks.set(taskId, task);
    }
  }, 500);
}

/**
 * GET /api/file/:taskId
 * Get download file
 */
router.get('/file/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadTasks.get(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Download not found' });
    }

    if (task.status !== 'completed') {
      return res.status(202).json({
        status: task.status,
        progress: task.progress,
        message: 'Download in progress'
      });
    }

    // In production, this would serve the actual audio file
    // For now, return a text file as placeholder
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="space-${task.spaceId}.${task.format}"`);
    
    res.json({
      message: 'Download ready',
      spaceId: task.spaceId,
      format: task.format,
      note: 'In production, this would serve the actual audio file'
    });
  } catch (error) {
    logger.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * POST /api/space/info
 * Fetch Space info using browser-fetched data
 * The frontend fetches Twitter directly and sends the data here for processing
 */
router.post('/space/info', async (req, res) => {
  try {
    const { spaceId, spaceData } = req.body;

    if (!spaceId) {
      return res.status(400).json({
        error: 'Space ID is required',
        code: 'SPACE_ID_REQUIRED'
      });
    }

    if (!spaceData) {
      return res.status(400).json({
        error: 'Space data is required',
        code: 'SPACE_DATA_REQUIRED'
      });
    }

    // Process the space data from browser
    const metadata = extractSpaceMetadata(spaceId, spaceData);

    if (!metadata) {
      return res.status(404).json({
        error: 'Could not extract Space information',
        code: 'EXTRACTION_FAILED'
      });
    }

    logger.info(`Space metadata extracted: ${spaceId}`);

    res.json(metadata);
  } catch (error) {
    logger.error('Space info error:', error);
    res.status(500).json({
      error: 'Failed to process Space data',
      code: 'PROCESS_FAILED'
    });
  }
});

/**
 * POST /api/space/download
 * Get download URL - returns the direct Space URL for browser download
 */
router.post('/space/download', async (req, res) => {
  try {
    const { spaceId, streamUrl, title, format } = req.body;

    if (!spaceId || !streamUrl) {
      return res.status(400).json({
        error: 'Space ID and stream URL are required',
        code: 'MISSING_PARAMS'
      });
    }

    logger.info(`Download prepared for Space: ${spaceId}`);

    // Return the stream URL for browser to download
    // Browser has Twitter auth, so it can access this directly
    res.json({
      success: true,
      downloadUrl: streamUrl,
      spaceId,
      title: title || `Space ${spaceId}`,
      format: format || 'm4a'
    });
  } catch (error) {
    logger.error('Download prep error:', error);
    res.status(500).json({
      error: 'Failed to prepare download',
      code: 'PREP_FAILED'
    });
  }
});

/**
 * Extract metadata from browser-fetched Space data
 */
function extractSpaceMetadata(spaceId, data) {
  try {
    // Handle different data formats
    let metadata = {};

    if (typeof data === 'string') {
      // JSON string - parse it
      try {
        data = JSON.parse(data);
      } catch {
        // Not JSON, try HTML parsing
        return extractFromHTML(spaceId, data);
      }
    }

    if (data.data?.audioSpace) {
      // GraphQL response format
      const space = data.data.audioSpace;
      metadata = parseGraphQLSpace(space);
    } else if (data.metadata) {
      // Our format
      metadata = data;
    } else {
      // Try to extract from whatever structure
      metadata = {
        id: spaceId,
        title: data.title || 'Untitled Space',
        status: mapSpaceState(data.state || data.status),
        streamUrl: data.streamUrl || data.liveArchiveUrl || data.audioUrl,
        host: data.host || data.creator || { name: 'Unknown', username: 'unknown' },
        duration: data.duration,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
      };
    }

    return metadata;
  } catch (error) {
    logger.error('Metadata extraction error:', error);
    return null;
  }
}

/**
 * Parse GraphQL Space response
 */
function parseGraphQLSpace(space) {
  const metadata = space.metadata || {};
  const rest = space.restoredBroadcast || {};
  
  return {
    id: metadata.restoredBroadcastId || rest?.restoredBroadcastId || space.restoredBroadcastId,
    title: metadata.title || rest?.title || 'Untitled Space',
    status: mapSpaceState(metadata.state),
    streamUrl: metadata.liveArchiveUrl || rest?.liveArchiveUrl,
    host: {
      name: space.creators?.users?.results?.[0]?.name || 'Unknown',
      username: space.creators?.users?.results?.[0]?.screen_name || 'unknown',
      avatarUrl: space.creators?.users?.results?.[0]?.profile_image_url,
    },
    duration: calculateDuration(metadata.startedAt || rest?.startedAt, metadata.endedAt || rest?.endedAt),
    startedAt: metadata.startedAt || rest?.startedAt,
    endedAt: metadata.endedAt || rest?.endedAt,
    participantCount: space.participants?.listeners?.count || 0,
  };
}

/**
 * Extract from HTML page
 */
function extractFromHTML(spaceId, html) {
  try {
    // Look for JSON data embedded in the page
    const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s) ||
                      html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s) ||
                      html.match(/({"audioSpace".*?})/s);
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1];
      const data = JSON.parse(jsonStr);
      
      if (data.props?.pageProps?.audioSpace) {
        return parseGraphQLSpace(data.props.pageProps.audioSpace);
      }
    }

    // Try to find stream URL directly
    const streamMatch = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    
    if (streamMatch) {
      return {
        id: spaceId,
        title: extractTitle(html),
        status: 'ended',
        streamUrl: streamMatch[1],
        host: extractHost(html),
      };
    }

    return null;
  } catch (error) {
    logger.error('HTML extraction error:', error);
    return null;
  }
}

/**
 * Extract title from HTML
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(' | X', '').replace(' on X', '').trim();
  }
  return 'Untitled Space';
}

/**
 * Extract host info from HTML
 */
function extractHost(html) {
  const hostMatch = html.match(/"creator":\s*{[^}]*"name":"([^"]+)"/) ||
                   html.match(/"username":"@([^"]+)"/);
  return {
    name: hostMatch?.[1] || 'Unknown',
    username: hostMatch?.[2] || 'unknown',
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

export default router;
