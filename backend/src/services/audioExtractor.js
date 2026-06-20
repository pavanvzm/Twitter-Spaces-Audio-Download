/**
 * Audio Download Service using yt-dlp
 * 
 * yt-dlp handles all the complexity of:
 * - Twitter/X authentication
 * - GraphQL API queries
 * - HLS manifest parsing
 * - Segment downloading
 * - Format conversion
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/tmp/x-spaces-downloads';
const YT_DLP_PATH = process.env.YT_DLP_PATH || '/home/openhands/.local/bin/yt-dlp';

// Format mappings for yt-dlp
const FORMAT_MAP = {
  'mp3': 'mp3',
  'wav': 'wav',
  'm4a': 'm4a',
  'webm': 'webm',
};

/**
 * Download a Twitter Space using yt-dlp
 */
export async function downloadSpace(spaceId, outputFormat = 'mp3', onProgress) {
  // Ensure download directory exists
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

  const outputPath = path.join(DOWNLOAD_DIR, `${spaceId}.%(ext)s`);

  // Build yt-dlp arguments
  const args = [
    // Twitter Space URL format
    `https://twitter.com/i/spaces/${spaceId}`,
    
    // Output template
    '-o', outputPath,
    
    // Audio only - extract best audio format
    '-x', // Extract audio
    
    // Audio format
    '--audio-format', outputFormat,
    
    // Prefer m4a for extraction to avoid re-encoding
    '--audio-quality', '0', // Best quality
    
    // No playlist (single Space)
    '--no-playlist',
    
    // User agent to mimic browser
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Add cookies support (for authenticated downloads)
    // '--cookies-from-browser', 'chrome',
    
    // Don't ask for anything
    '--no-warnings',
    
    // Progress
    '--newline',
  ];

  return new Promise((resolve, reject) => {
    logger.info(`Starting yt-dlp download for Space: ${spaceId}`);
    logger.info(`Command: ${YT_DLP_PATH} ${args.join(' ')}`);
    
    const process = spawn(YT_DLP_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';
    let lastProgress = 0;

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      logger.debug(`yt-dlp: ${text.trim()}`);
      
      // Parse progress from yt-dlp output
      if (onProgress) {
        // Try to parse percentage
        const progressMatch = text.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          if (progress >= lastProgress) {
            lastProgress = progress;
            onProgress(progress);
          }
        }
        // Also check for download progress pattern
        const downloadMatch = text.match(/\[download\]\s+(\d+\.?\d+).*?at\s+(\d+\.?\d+)/);
        if (downloadMatch) {
          onProgress(50); // Middle of download
        }
      }
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      logger.debug(`yt-dlp stderr: ${text.trim()}`);
    });

    process.on('close', async (code) => {
      if (code === 0) {
        logger.info(`yt-dlp completed successfully for Space: ${spaceId}`);
        
        // Find the output file
        const files = await fs.readdir(DOWNLOAD_DIR);
        const spaceFiles = files.filter(f => f.startsWith(spaceId) && !f.endsWith('.part') && !f.endsWith('.temp'));
        
        if (spaceFiles.length > 0) {
          const finalOutputPath = path.join(DOWNLOAD_DIR, spaceFiles[0]);
          const stats = await fs.stat(finalOutputPath);
          
          onProgress?.(100);
          
          resolve({
            path: finalOutputPath,
            size: stats.size,
            format: outputFormat,
          });
        } else {
          reject(new Error('Download completed but output file not found'));
        }
      } else {
        logger.error(`yt-dlp failed with code ${code}`);
        logger.error(`Error output: ${errorOutput}`);
        
        // Extract a clean error message
        const errorLines = errorOutput.split('\n').filter(l => l.includes('ERROR'));
        const errorMsg = errorLines[errorLines.length - 1]?.replace(/^ERROR:\s*/, '').trim() || 'Unknown error';
        
        // Provide more helpful error messages
        let userMessage = errorMsg;
        if (errorMsg.includes('invalid broadcast_ids')) {
          userMessage = 'This Space ID is invalid or the Space does not exist';
        } else if (errorMsg.includes('Sign in')) {
          userMessage = 'This Space requires login or is private';
        } else if (errorMsg.includes('No space found')) {
          userMessage = 'No Space found with this ID';
        }
        
        reject(new Error(`Download failed: ${userMessage}`));
      }
    });

    process.on('error', (error) => {
      logger.error(`yt-dlp spawn error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Download using wget fallback (simpler, less features)
 */
export async function downloadWithWget(spaceId, audioUrl, outputFormat = 'mp3') {
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  
  const outputPath = path.join(DOWNLOAD_DIR, `${spaceId}.${outputFormat}`);
  
  return new Promise((resolve, reject) => {
    const args = [
      '--tries=3',
      '--timeout=30',
      '-O', outputPath,
      audioUrl,
    ];

    logger.info(`Starting wget download: wget ${args.join(' ')}`);

    const process = spawn('wget', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', async (code) => {
      if (code === 0) {
        const stats = await fs.stat(outputPath);
        resolve({
          path: outputPath,
          size: stats.size,
          format: outputFormat,
        });
      } else {
        reject(new Error(`wget failed: ${output}`));
      }
    });
  });
}

/**
 * Convert audio file to different format using FFmpeg
 */
export async function convertAudio(inputPath, outputFormat) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const outputPath = path.join(dir, `${base}.${outputFormat}`);
  
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', inputPath,
      '-y', // Overwrite
    ];

    switch (outputFormat) {
      case 'mp3':
        ffmpegArgs.push('-codec:a', 'libmp3lame', '-q:a', '2');
        break;
      case 'wav':
        ffmpegArgs.push('-codec:a', 'pcm_s16le');
        break;
      case 'm4a':
        ffmpegArgs.push('-codec:a', 'copy');
        break;
    }

    ffmpegArgs.push(outputPath);

    const process = spawn('ffmpeg', ffmpegArgs);

    process.on('close', async (code) => {
      if (code === 0) {
        const stats = await fs.stat(outputPath);
        resolve({
          path: outputPath,
          size: stats.size,
          format: outputFormat,
        });
      } else {
        reject(new Error('FFmpeg conversion failed'));
      }
    });
  });
}

/**
 * Check if yt-dlp is available
 */
export async function checkYtDlp() {
  try {
    const process = spawn(YT_DLP_PATH, ['--version']);
    return new Promise((resolve) => {
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      process.on('close', (code) => {
        logger.info(`yt-dlp version: ${output.trim()}`);
        resolve(code === 0);
      });
      process.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 1000);
    });
  } catch {
    return false;
  }
}

// Legacy exports for backwards compatibility
export const downloadAudioSegments = downloadSpace;
export const parseM3U8 = async () => ({ segments: [], isLive: false });
