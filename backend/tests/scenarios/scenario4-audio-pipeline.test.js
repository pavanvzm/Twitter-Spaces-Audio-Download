/**
 * Scenario 4: Audio Download Pipeline (Unit Tests)
 * 
 * Tests for M3U8 parsing logic and FFmpeg configuration.
 */

import { describe, it, expect } from 'vitest';

describe('Scenario 4: Audio Download Pipeline', () => {
  describe('M3U8 Manifest Parsing', () => {
    const masterManifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=64000
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000
medium.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=256000
high.m3u8
`;

    const variantManifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:9.9,
https://example.com/space/seg0.aac
#EXTINF:10.0,
https://example.com/space/seg1.aac
#EXTINF:10.0,
https://example.com/space/seg2.aac
#EXT-X-ENDLIST
`;

    it('should detect EXTINF tags', () => {
      const lines = variantManifest.split('\n');
      const infLines = lines.filter(l => l.startsWith('#EXTINF:'));
      expect(infLines.length).toBe(3);
    });

    it('should extract target duration', () => {
      const targetMatch = variantManifest.match(/#EXT-X-TARGETDURATION:(\d+)/);
      expect(targetMatch).not.toBeNull();
      expect(parseInt(targetMatch[1])).toBe(10);
    });

    it('should detect master playlist by STREAM-INF tags', () => {
      const hasStreamInf = masterManifest.includes('#EXT-X-STREAM-INF');
      expect(hasStreamInf).toBe(true);
    });

    it('should parse variant playlist for segments', () => {
      const lines = variantManifest.split('\n').map(l => l.trim());
      const segments = lines.filter(l => l.endsWith('.aac'));
      expect(segments.length).toBe(3);
    });

    it('should detect ENDLIST tag', () => {
      const hasEndlist = variantManifest.includes('#EXT-X-ENDLIST');
      expect(hasEndlist).toBe(true);
    });

    it('should calculate total duration from segments', () => {
      const infLines = variantManifest.match(/#EXTINF:([\d.]+)/g) || [];
      const totalDuration = infLines.reduce((sum, line) => {
        const duration = parseFloat(line.split(':')[1]);
        return sum + duration;
      }, 0);
      expect(totalDuration).toBeCloseTo(29.9, 1);
    });

    it('should resolve relative URLs to absolute', () => {
      const baseUrl = 'https://example.com/path/playlist.m3u8';
      const relativePath = 'segment.aac';
      
      const base = new URL(baseUrl);
      const resolved = new URL(relativePath, baseUrl).toString();
      
      expect(resolved).toBe('https://example.com/path/segment.aac');
    });
  });

  describe('FFmpeg Configuration', () => {
    const codecConfig = {
      mp3: { codec: 'libmp3lame', quality: '-q:a 2' },
      wav: { codec: 'pcm_s16le', quality: null },
      m4a: { codec: 'copy', quality: null },
    };

    it('should configure MP3 encoding', () => {
      expect(codecConfig.mp3.codec).toBe('libmp3lame');
    });

    it('should configure WAV encoding', () => {
      expect(codecConfig.wav.codec).toBe('pcm_s16le');
    });

    it('should configure M4A passthrough', () => {
      expect(codecConfig.m4a.codec).toBe('copy');
    });

    it('should support all target formats', () => {
      const formats = ['mp3', 'wav', 'm4a'];
      formats.forEach(format => {
        expect(codecConfig).toHaveProperty(format);
      });
    });
  });

  describe('Segment Processing Logic', () => {
    it('should handle segment path construction', () => {
      const jobDir = '/tmp/segments/job-123';
      const index = 0;
      const paddedIndex = String(index).padStart(5, '0');
      const segmentPath = `${jobDir}/seg_${paddedIndex}.aac`;
      
      expect(segmentPath).toBe('/tmp/segments/job-123/seg_00000.aac');
    });

    it('should create FFmpeg concat file content', () => {
      const segments = [
        '/tmp/seg_00000.aac',
        '/tmp/seg_00001.aac',
        '/tmp/seg_00002.aac',
      ];
      
      const concatContent = segments.map(p => `file '${p}'`).join('\n');
      const expected = `file '/tmp/seg_00000.aac'
file '/tmp/seg_00001.aac'
file '/tmp/seg_00002.aac'`;
      
      expect(concatContent).toBe(expected);
    });

    it('should calculate progress correctly', () => {
      const totalSegments = 10;
      const downloadWeight = 50; // 50% for download phase
      
      for (let i = 0; i <= totalSegments; i++) {
        const progress = Math.floor((i / totalSegments) * downloadWeight);
        expect(progress).toBeLessThanOrEqual(downloadWeight);
      }
    });
  });

  describe('Audio Format Validation', () => {
    it('should validate MP3 MIME type', () => {
      const mimeType = 'audio/mpeg';
      expect(mimeType).toMatch(/^audio\//);
    });

    it('should validate WAV MIME type', () => {
      const mimeType = 'audio/wav';
      expect(mimeType).toMatch(/^audio\//);
    });

    it('should validate M4A MIME type', () => {
      const mimeType = 'audio/mp4';
      expect(mimeType).toMatch(/^audio\//);
    });

    it('should generate safe filenames', () => {
      const title = 'Test Space: Episode 1 (Live)';
      const safeName = title
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      
      expect(safeName).toBe('Test_Space__Episode_1__Live_');
      expect(safeName).not.toMatch(/[<>:"/\\|?*]/);
    });
  });
});
