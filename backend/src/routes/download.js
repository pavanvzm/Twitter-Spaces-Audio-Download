/**
 * Download Routes - Audio Stream Processing using yt-dlp
 * 
 * Uses yt-dlp to handle Twitter/X Space downloads:
 * - Handles authentication and API complexity
 * - Extracts audio and converts to desired format
 * - Progress tracking and status reporting
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { downloadSpace, checkYtDlp } from '../services/audioExtractor.js';
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

// In-memory task storage
const downloadTasks = new Map();

/**
 * POST /api/download/start
 * Start a download task for a Space using yt-dlp
 */
router.post('/start', downloadRateLimiter, async (req, res) => {
  try {
    const { spaceId, format = 'mp3' } = req.body;

    if (!spaceId) {
      return res.status(400).json({
        error: 'Space ID is required',
        code: 'SPACE_ID_REQUIRED'
      });
    }

    // Validate space ID format
    if (!/^[A-Za-z0-9]+$/.test(spaceId)) {
      return res.status(400).json({
        error: 'Invalid Space ID format',
        code: 'INVALID_SPACE_ID'
      });
    }

    // Check if yt-dlp is available
    const ytDlpAvailable = await checkYtDlp();
    if (!ytDlpAvailable) {
      return res.status(503).json({
        error: 'yt-dlp is not available',
        code: 'YTDLP_NOT_AVAILABLE',
        details: 'Please install yt-dlp: pip install yt-dlp'
      });
    }

    await ensureDownloadDir();

    // Create task
    const taskId = uuidv4();

    // Initialize task
    const task = {
      id: taskId,
      spaceId,
      metadata: {
        title: `Space ${spaceId}`,
      },
      status: 'pending',
      progress: 0,
      format,
      outputPath: null,
      createdAt: Date.now(),
    };

    // Store task in memory
    downloadTasks.set(taskId, task);

    // Start async download
    processDownload(taskId);

    logger.info(`Download started: ${spaceId} -> ${taskId}`);

    res.json({
      success: true,
      taskId,
      metadata: task.metadata,
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

    // Check if file exists - try multiple paths
    let actualPath = task.outputPath;
    let fileExists = false;
    
    // Try the direct path first
    if (actualPath) {
      try {
        await fs.access(actualPath);
        fileExists = true;
      } catch {
        actualPath = null;
      }
    }
    
    // Try to find by space ID prefix
    if (!fileExists) {
      const files = await fs.readdir(DOWNLOAD_DIR);
      const matching = files.find(f => f.startsWith(task.spaceId) && !f.endsWith('.part') && !f.endsWith('.temp'));
      if (matching) {
        actualPath = path.join(DOWNLOAD_DIR, matching);
        task.outputPath = actualPath;
        fileExists = true;
      }
    }
    
    if (!fileExists || !actualPath) {
      return res.status(404).json({
        error: 'File not found on disk',
        code: 'FILE_NOT_FOUND'
      });
    }

    // Generate filename from metadata
    const safeName = (task.metadata?.title || task.spaceId)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const ext = path.extname(actualPath).slice(1) || task.format;
    const filename = `${safeName}.${ext}`;

    res.setHeader('Content-Type', `audio/${ext === 'mp3' ? 'mpeg' : ext}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileBuffer = await fs.readFile(actualPath);
    res.send(fileBuffer);
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
    if (task.outputPath) {
      try {
        await fs.unlink(task.outputPath);
      } catch {
        // File may not exist
      }
    }

    // Remove from tasks
    downloadTasks.delete(taskId);

    logger.info(`Download deleted: ${taskId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({
      error: 'Failed to delete download',
      code: 'DELETE_FAILED'
    });
  }
});

/**
 * Process download asynchronously using yt-dlp
 */
async function processDownload(taskId) {
  const task = downloadTasks.get(taskId);
  if (!task) return;

  try {
    task.status = 'downloading';
    task.progress = 0;

    logger.info(`Starting yt-dlp download: ${taskId} for Space: ${task.spaceId}`);

    // Download using yt-dlp
    const result = await downloadSpace(
      task.spaceId,
      task.format,
      (progress) => {
        task.progress = Math.min(progress, 95);
      }
    );

    // Update task with result
    task.outputPath = result.path;
    task.fileSize = result.size;
    task.status = 'completed';
    task.progress = 100;
    task.metadata.format = result.format;

    logger.info(`Download completed: ${taskId}, size: ${task.fileSize}, path: ${result.path}`);
  } catch (error) {
    logger.error(`Download failed: ${taskId}`, error);
    task.status = 'failed';
    task.error = error.message;
    task.progress = 0;
  }
}

export default router;
