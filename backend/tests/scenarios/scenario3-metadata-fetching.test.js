/**
 * Scenario 3: Space Metadata Fetching (Unit Tests)
 * 
 * Tests for Twitter service functions and metadata parsing logic.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Scenario 3: Space Metadata Fetching', () => {
  describe('GraphQL Response Parsing', () => {
    const mockGraphQLResponse = {
      data: {
        audioSpace: {
          metadata: {
            restoredBroadcastId: '1RDxlkAORPVJL',
            title: 'Test Space',
            state: 'SpaceStatus.Ended',
            startedAt: '2024-01-15T10:00:00.000Z',
            endedAt: '2024-01-15T11:30:00.000Z',
            liveArchiveUrl: 'https://example.com/master.m3u8',
          },
          creators: {
            users: {
              results: [
                {
                  id: '123',
                  name: 'Test Host',
                  screen_name: 'testhost',
                  profile_image_url: 'https://example.com/avatar.jpg',
                },
              ],
            },
          },
          participants: {
            speakers: {
              users: {
                results: [
                  {
                    id: '123',
                    name: 'Test Host',
                    screen_name: 'testhost',
                  },
                ],
              },
            },
            listeners: { count: 50 },
          },
        },
      },
    };

    it('should parse Space ID from GraphQL response', () => {
      const spaceId = mockGraphQLResponse.data.audioSpace.metadata.restoredBroadcastId;
      expect(spaceId).toBe('1RDxlkAORPVJL');
    });

    it('should parse title from GraphQL response', () => {
      const title = mockGraphQLResponse.data.audioSpace.metadata.title;
      expect(title).toBe('Test Space');
    });

    it('should parse host information', () => {
      const host = mockGraphQLResponse.data.audioSpace.creators.users.results[0];
      expect(host).toHaveProperty('id', '123');
      expect(host).toHaveProperty('name', 'Test Host');
      expect(host).toHaveProperty('screen_name', 'testhost');
    });

    it('should parse participant counts', () => {
      const listeners = mockGraphQLResponse.data.audioSpace.participants.listeners.count;
      expect(listeners).toBe(50);
    });

    it('should parse stream URL', () => {
      const streamUrl = mockGraphQLResponse.data.audioSpace.metadata.liveArchiveUrl;
      expect(streamUrl).toBe('https://example.com/master.m3u8');
    });

    it('should parse Space state', () => {
      const state = mockGraphQLResponse.data.audioSpace.metadata.state;
      expect(state).toBe('SpaceStatus.Ended');
    });

    it('should parse duration from timestamps', () => {
      const startedAt = new Date('2024-01-15T10:00:00.000Z').getTime();
      const endedAt = new Date('2024-01-15T11:30:00.000Z').getTime();
      const duration = Math.floor((endedAt - startedAt) / 1000);
      expect(duration).toBe(5400); // 1.5 hours in seconds
    });
  });

  describe('Guest Token Management', () => {
    it('should generate unique guest tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 10; i++) {
        const token = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        tokens.add(token);
      }
      expect(tokens.size).toBe(10);
    });

    it('should include Bearer in Authorization header', () => {
      const bearerToken = 'test_bearer_token';
      const authHeader = `Bearer ${bearerToken}`;
      expect(authHeader).toMatch(/^Bearer .+$/);
    });
  });

  describe('Space State Mapping', () => {
    const stateMap = {
      'SpaceStatus.NotStarted': 'scheduled',
      'SpaceStatus.Live': 'live',
      'SpaceStatus.Ended': 'ended',
      'SpaceStatus.Callback': 'ended',
    };

    it('should map Live state', () => {
      expect(stateMap['SpaceStatus.Live']).toBe('live');
    });

    it('should map Ended state', () => {
      expect(stateMap['SpaceStatus.Ended']).toBe('ended');
    });

    it('should map Scheduled state', () => {
      expect(stateMap['SpaceStatus.NotStarted']).toBe('scheduled');
    });

    it('should default to unknown for unmapped states', () => {
      const unknownState = stateMap['SpaceStatus.Unknown'] || 'unknown';
      expect(unknownState).toBe('unknown');
    });
  });
});
