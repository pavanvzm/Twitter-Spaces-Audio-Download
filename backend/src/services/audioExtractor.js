/**
 * Audio Extractor Service
 * 
 * Former X Staff Engineering Insight:
 * X Spaces audio is delivered as segmented HLS streams. Here's how it works:
 * 
 * 1. The Space has a master .m3u8 manifest listing different quality variants
 * 2. Each variant has its own .m3u8 with segment URLs (usually .aac files)
 * 3. Segments are 6-12 seconds each, stored on video.twimg.com CDN
 * 4. Player downloads segments and plays them sequentially
 * 
 * To download the full audio:
 * 1. Parse the master manifest to select quality
 * 2. Parse the variant manifest for segment URLs
 * 3. Download all segments with auth headers
 * 4. Concatenate segments and convert to desired format
 * 
 * FFmpeg handles all of this beautifully with the concat protocol.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger.js';

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/tmp/x-spaces-downloads';
const SEGMENT_DIR = path.join(DOWNLOAD_DIR, 'segments');
const TEMP_DIR = path.join(DOWNLOAD_DIR, 'temp');

// Ensure directories exist
async function ensureDirs() {
  await fs.mkdir(SEGMENT_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

/**
 * Parse M3U8 manifest and extract segment URLs
 */
export async function parseM3U8(manifestUrl, accessToken) {
  try {
    const response = await fetch(manifestUrl, {
      headers: getSegmentHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }

    const content = await response.text();
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    
    const segments = [];
    const variantPlaylists = [];
    let targetDuration = 0;

    // Parse header for metadata
    const headerMatch = content.match(/#EXTM3U/);
    if (!headerMatch) {
      throw new Error('Invalid M3U8 file');
    }

    // Determine if master or variant playlist
    const isMasterPlaylist = lines.some(l => l.startsWith('#EXT-X-STREAM-INF'));

    if (isMasterPlaylist) {
      // Master playlist - extract variants
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const variant = { bandwidth: 0, url: null };
          
          // Parse attributes
          const attrs = line.substring(17);
          const bandwidthMatch = attrs.match(/BANDWIDTH=(\d+)/);
          if (bandwidthMatch) {
            variant.bandwidth = parseInt(bandwidthMatch[1]);
          }

          // Next line is the URL
          if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
            variant.url = resolveUrl(manifestUrl, lines[i + 1]);
            variantPlaylists.push(variant);
          }
        }
      }

      // Sort by bandwidth and return highest quality
      variantPlaylists.sort((a, b) => b.bandwidth - a.bandwidth);
      
      // Fetch the best variant
      if (variantPlaylists.length > 0) {
        return parseM3U8(variantPlaylists[0].url, accessToken);
      }

      return { segments: [], isLive: false };
    }

    // Variant playlist - extract segments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        targetDuration = parseInt(line.substring(22));
      }

      if (line.startsWith('#EXTINF:')) {
        const duration = parseFloat(line.substring(8).split(',')[0]);
        
        // Next non-comment line is the segment URL
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (!nextLine.startsWith('#') && nextLine.length > 0) {
            segments.push({
              url: resolveUrl(manifestUrl, nextLine),
              duration,
            });
            break;
          }
        }
      }
    }

    const isLive = content.includes('#EXT-X-PLAYLIST-TYPE:EVENT') || 
                   content.includes('#EXT-X-PLAYLIST-TYPE:VOD');

    return {
      segments,
      targetDuration,
      isLive,
      totalDuration: segments.reduce((sum, s) => sum + s.duration, 0),
    };
  } catch (error) {
    logger.error('Parse M3U8 error:', error);
    throw error;
  }
}

/**
 * Download audio segments and merge into single file
 */
export async function downloadAudioSegments(
  manifestUrl, 
  accessToken, 
  outputFormat = 'mp3',
  onProgress
) {
  await ensureDirs();

  const jobId = path.basename(await fs.mkdtemp(path.join(SEGMENT_DIR, 'job-')));
  const jobDir = path.join(SEGMENT_DIR, jobId);
  const segmentListFile = path.join(jobDir, 'segments.txt');
  
  await fs.mkdir(jobDir, { recursive: true });

  try {
    // Parse manifest
    logger.info(`Parsing manifest: ${manifestUrl}`);
    const manifest = await parseM3U8(manifestUrl, accessToken);

    if (manifest.segments.length === 0) {
      throw new Error('No segments found in manifest');
    }

    logger.info(`Found ${manifest.segments.length} segments, total duration: ${manifest.totalDuration}s`);

    // Download segments
    const segmentPaths = [];
    const totalSegments = manifest.segments.length;

    for (let i = 0; i < manifest.segments.length; i++) {
      const segment = manifest.segments[i];
      const segmentPath = path.join(jobDir, `seg_${String(i).padStart(5, '0')}.aac`);
      
      try {
        await downloadSegment(segment.url, segmentPath, accessToken);
        segmentPaths.push(segmentPath);
        
        // Report progress
        const progress = Math.floor(((i + 1) / totalSegments) * 50); // 50% for download
        onProgress?.(progress);
      } catch (error) {
        logger.warn(`Failed to download segment ${i}: ${error.message}`);
        // Continue with other segments
      }
    }

    if (segmentPaths.length === 0) {
      throw new Error('Failed to download any segments');
    }

    // Create FFmpeg concat file
    const concatContent = segmentPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(segmentListFile, concatContent);

    // Merge segments using FFmpeg
    const mergedPath = path.join(jobDir, 'merged.aac');
    const outputPath = path.join(TEMP_DIR, `${jobId}.${outputFormat}`);

    logger.info('Merging segments with FFmpeg...');
    onProgress?.(75);

    await mergeWithFFmpeg(segmentListFile, mergedPath);
    onProgress?.(85);

    // Convert to desired format
    logger.info(`Converting to ${outputFormat}...`);
    await convertWithFFmpeg(mergedPath, outputPath, outputFormat);
    onProgress?.(95);

    // Cleanup segments
    await fs.rm(jobDir, { recursive: true, force: true });

    logger.info(`Download complete: ${outputPath}`);
    onProgress?.(100);

    return {
      tempPath: outputPath,
      format: outputFormat,
      segmentCount: segmentPaths.length,
      totalDuration: manifest.totalDuration,
    };
  } catch (error) {
    // Cleanup on error
    await fs.rm(jobDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Download a single segment
 */
async function downloadSegment(url, outputPath, accessToken) {
  const response = await fetch(url, {
    headers: getSegmentHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Segment download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
}

/**
 * Merge segments using FFmpeg concat
 */
function mergeWithFFmpeg(segmentList, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(segmentList)
      .inputFormat('concat')
      .outputOptions([
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/**
 * Convert audio file to desired format
 */
function convertWithFFmpeg(inputPath, outputPath, format) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath);
    
    switch (format) {
      case 'mp3':
        command
          .audioCodec('libmp3lame')
          .audioOptions([
            '-q:a', '2', // High quality
          ]);
        break;
      
      case 'wav':
        command
          .audioCodec('pcm_s16le');
        break;
      
      case 'm4a':
      default:
        command
          .audioCodec('copy');
        break;
    }

    command
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/**
 * Resolve relative URLs in manifest
 */
function resolveUrl(baseUrl, relativeUrl) {
  if (relativeUrl.startsWith('http')) {
    return relativeUrl;
  }
  
  const base = new URL(baseUrl);
  base.pathname = path.dirname(base.pathname) + '/' + relativeUrl;
  return base.toString();
}

/**
 * Get headers for segment requests
 */
function getSegmentHeaders(accessToken) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': accessToken ? `Bearer ${accessToken}` : undefined,
    'Referer': 'https://twitter.com/',
    'Origin': 'https://twitter.com',
  };
}

/**
 * Alternative: Direct FFmpeg HLS download
 * This is more efficient as FFmpeg handles segment downloading
 */
export async function downloadWithFFmpeg(manifestUrl, outputPath, accessToken) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(manifestUrl)
      .inputOptions([
        '-headers', `Authorization: Bearer ${accessToken}\r\n`,
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
      ])
      .audioCodec('libmp3lame')
      .audioOptions(['-q:a', '2'])
      .output(outputPath)
      .on('progress', (progress) => {
        logger.debug(`FFmpeg progress: ${progress.percent}%`);
      })
      .on('end', () => {
        logger.info(`FFmpeg download complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (error) => {
        logger.error('FFmpeg error:', error);
        reject(error);
      })
      .run();
  });
}
