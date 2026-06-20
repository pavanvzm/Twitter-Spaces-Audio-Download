/**
 * Twitter API Mock
 * 
 * Provides mock responses for Twitter/X API endpoints used in testing.
 */

import crypto from 'crypto';

// Mock Space data for testing
export const mockSpaceData = {
  id: '1RDxlkAORPVJL',
  title: 'Test Space for Download',
  host: {
    id: '123456789',
    name: 'Test Host',
    username: 'testhost',
    avatarUrl: 'https://pbs.twimg.com/profile_images/test.jpg',
  },
  status: 'ended',
  startedAt: '2024-01-15T10:00:00.000Z',
  endedAt: '2024-01-15T11:30:00.000Z',
  duration: 5400,
  participantCount: 150,
  speakers: [
    {
      id: '123456789',
      name: 'Test Host',
      username: 'testhost',
      avatarUrl: 'https://pbs.twimg.com/profile_images/test.jpg',
    },
  ],
  listeners: { count: 148 },
  streamUrl: 'https://example.com/space/1RDxlkAORPVJL/master.m3u8',
};

// Mock GraphQL response
export const mockGraphQLResponse = {
  data: {
    audioSpace: {
      metadata: {
        restoredBroadcastId: '1RDxlkAORPVJL',
        title: 'Test Space for Download',
        state: 'SpaceStatus.Ended',
        startedAt: '2024-01-15T10:00:00.000Z',
        endedAt: '2024-01-15T11:30:00.000Z',
        liveArchiveUrl: 'https://example.com/space/1RDxlkAORPVJL/master.m3u8',
      },
      creators: {
        users: {
          results: [
            {
              id: '123456789',
              name: 'Test Host',
              screen_name: 'testhost',
              profile_image_url: 'https://pbs.twimg.com/profile_images/test.jpg',
            },
          ],
        },
      },
      participants: {
        speakers: {
          users: {
            results: [
              {
                id: '123456789',
                name: 'Test Host',
                screen_name: 'testhost',
                profile_image_url: 'https://pbs.twimg.com/profile_images/test.jpg',
              },
            ],
          },
        },
        listeners: { count: 148 },
      },
    },
  },
};

// Mock M3U8 manifests
export const mockMasterManifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=64000
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000
medium.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=256000
high.m3u8
`;

export const mockVariantManifest = `#EXTM3U
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

// Guest token generator
let guestTokenCounter = 0;
export function generateGuestToken() {
  return `guest_token_${++guestTokenCounter}_${crypto.randomUUID().substring(0, 8)}`;
}
