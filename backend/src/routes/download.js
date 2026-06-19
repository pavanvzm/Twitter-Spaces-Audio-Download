/**
 * Download Routes - Audio Stream Processing
 * 
 * Former X Staff Engineering Insight:
 * Space audio is delivered as segmented HLS streams (AAC in MPEG-TS containers).
 * Each segment is typically 6-12 seconds. To create a single audio file:
 * 
 * 1. Fetch the .m3u8 manifest (playlist)
 * 2. Parse segment URLs from the manifest
 * 3. Download segments with proper headers (auth token required)
 * 4. Concatenate segments using FFmpeg
 * 5. Convert to desired format (MP3/WAV)
 * 
 * This approach mirrors how X's own players reconstruct audio for playback.
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import { getSessionByToken } from './auth.js';
import { fetchSpaceMetadata, fetchSpaceAudioUrl } from '../services/twitter.js';
import { downloadAudioSegments, parseM3U8 } from '../services/audioExtractor.js';
import { logger } from '../utils/logger.js';
import { downloadRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Storage directory for downloads
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/tmp/x-spaces-downloads';

// Ensure download directory exists
async function ensureDownloadDir() {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * POST /api/download/start
 * Start a download task for a Space using guest token (no auth required)
 * 
 * This initiates the download process. For large Spaces, this runs
 * asynchronously and returns a task ID for progress tracking.
 */
router.post('/start', downloadRateLimiter, async (req, res) => {
  try {
    const { spaceId, format = 'mp3', quality = 'high' } = req.body;

    if (!spaceId) {
      return res.status(400).json({
        error: 'Space ID is required',
        code: 'SPACE_ID_REQUIRED'
      });
    }

    await ensureDownloadDir();

    // Create task
    const taskId = uuidv4();
    const outputPath = path.join(DOWNLOAD_DIR, `${taskId}.${format}`);

    // Fetch Space metadata using guest token (no auth required)
    const metadata = await fetchSpaceMetadata(null, spaceId);
    if (!metadata) {
      return res.status(404).json({
        error: 'Space not found or not accessible',
        code: 'SPACE_NOT_FOUND'
      });
    }

    // Get audio URL using guest token
    const audioData = await fetchSpaceAudioUrl(null, spaceId);
    if (!audioData) {
      return res.status(400).json({
        error: 'Audio not available',
        code: 'AUDIO_UNAVAILABLE',
        details: 'This Space may still be live, private, or recording is restricted'
      });
    }

    // Initialize task
    const task = {
      id: taskId,
      spaceId,
      metadata,
      status: 'pending',
      progress: 0,
      format,
      quality,
      outputPath,
      createdAt: Date.now(),
    };

    // Store task in memory (use Redis/DB in production)
    downloadTasks.set(taskId, task);

    // Start async download (uses guest token internally)
    processDownload(taskId, audioData.audioUrl, null);

    logger.info(`Download started (guest token): ${spaceId} -> ${taskId}`);

    res.json({
      success: true,
      taskId,
      metadata: {
        title: metadata.title,
        host: metadata.host,
        duration: metadata.duration,
        startedAt: metadata.startedAt,
      },
      status: 'pending',
    });
  } catch (error) {
    logger.error('Download start error:', error);
    res.status(500).json({
      error: 'Failed to start download',
      code: 'DOWNLOAD_START_FAILED'
    });
  }
});

/**
 * GET /api/download/:taskId
 * Get download task status
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadTasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    res.json({
      taskId: task.id,
      spaceId: task.spaceId,
      status: task.status,
      progress: task.progress,
      metadata: task.metadata,
      error: task.error,
      fileSize: task.fileSize,
    });
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({
      error: 'Failed to get task status',
      code: 'TASK_FETCH_FAILED'
    });
  }
});

/**
 * GET /api/download/:taskId/file
 * Download the completed audio file
 */
router.get('/:taskId/file', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadTasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        error: 'Download not complete',
        code: 'NOT_COMPLETED',
        status: task.status,
        progress: task.progress,
      });
    }

    // Check if file exists
    try {
      await fs.access(task.outputPath);
    } catch {
      return res.status(404).json({
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
    }

    // Generate filename from metadata
    const safeName = (task.metadata?.title || 'space')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const filename = `${safeName}.${task.format}`;

    res.setHeader('Content-Type', `audio/${task.format === 'mp3' ? 'mpeg' : task.format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = await fs.readFile(task.outputPath);
    res.send(fileStream);
  } catch (error) {
    logger.error('Download file error:', error);
    res.status(500).json({
      error: 'Failed to download file',
      code: 'FILE_DOWNLOAD_FAILED'
    });
  }
});

/**
 * DELETE /api/download/:taskId
 * Cancel/delete a download task
 */
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadTasks.get(taskId);

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Delete file if exists
    try {
      await fs.unlink(task.outputPath);
    } catch {
      // File may not exist
    }

    // Remove from tasks
    downloadTasks.delete(taskId);

    logger.info(`Download deleted: ${taskId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({
      error: 'Failed to delete task',
      code: 'DELETE_FAILED'
    });
  }
});

/**
 * Process download asynchronously
 */
async function processDownload(taskId, audioUrl, accessToken) {
  const task = downloadTasks.get(taskId);
  if (!task) return;

  try {
    task.status = 'downloading';
    task.progress = 0;

    logger.info(`Starting download: ${taskId}`);

    // Download and process audio
    const result = await downloadAudioSegments(
      audioUrl,
      accessToken,
      task.format,
      (progress) => {
        task.progress = progress;
      }
    );

    // Move temp file to final location
    await fs.rename(result.tempPath, task.outputPath);
    
    // Get file size
    const stats = await fs.stat(task.outputPath);
    task.fileSize = stats.size;

    task.status = 'completed';
    task.progress = 100;

    logger.info(`Download completed: ${taskId}, size: ${task.fileSize}`);
  } catch (error) {
    logger.error(`Download failed: ${taskId}`, error);
    task.status = 'failed';
    task.error = error.message;
  }
}

// In-memory task storage
const downloadTasks = new Map();

export default router;
