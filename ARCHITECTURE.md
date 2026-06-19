# X Spaces Audio Downloader - System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         X Spaces Audio Downloader                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │   User   │────▶│    Web   │────▶│  Proxy   │────▶│   X API  │            │
│  │ Browser  │     │   App    │     │  Server  │     │ Internal │            │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘            │
│       │                                                    │                 │
│       │         ┌──────────┐     ┌──────────┐             │                 │
│       └────────▶│ Android  │────▶│   CDN    │◀────────────┘                 │
│                 │   App    │     │ Endpoint │                               │
│                 └──────────┘     └──────────┘                               │
│                                        │                                     │
│                                        ▼                                     │
│                                 ┌──────────┐                                │
│                                 │  FFmpeg  │                                │
│                                 │  Pipeline│                                │
│                                 └──────────┘                                │
│                                        │                                     │
│                                        ▼                                     │
│                                 ┌──────────┐                                │
│                                 │   MP3    │                                │
│                                 │  /WAV    │                                │
│                                 │   File   │                                │
│                                 └──────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### OAuth 2.0 PKCE Flow (As Implemented by Former X Staff)

```
1. User clicks "Login with X"
2. App generates PKCE code_verifier + code_challenge
3. Redirect to X OAuth authorization endpoint
4. User grants permissions
5. X redirects back with authorization code
6. App exchanges code for access_token + refresh_token
7. Tokens stored securely:
   - Web: HttpOnly cookies + encrypted localStorage
   - Android: EncryptedSharedPreferences + Android Keystore
```

### Required Scopes

```json
{
  "scopes": [
    "tweet.read",
    "users.read",
    "offline.access"
  ]
}
```

### Token Refresh Strategy

```
Access Token TTL: ~2 hours
Refresh Token TTL: ~30 days

Auto-refresh triggers:
- 5 minutes before expiration
- On 401 response
- On network reconnect after offline
```

## Internal Endpoint Discovery

### Endpoints Used (Based on Internal Knowledge)

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `https://api.twitter.com/1.1/guest/activate.json` | Guest token | App-only |
| `https://twitter.com/i/api/graphql/{id}/AudioSpaceById` | Space metadata | User |
| `https://twitter.com/i/api/graphql/{id}/AudioSpace` | Live Space data | User |
| `https://abs.twimg.com/responsive-web/client-web/main.*.js` | Player endpoints | User |

### HLS Manifest Extraction

```
Flow:
1. Query AudioSpaceById GraphQL endpoint
2. Parse response for `metadata.liveArchiveUrl` or `metadata.auditoryMarket`
3. Extract HLS manifest URL (.m3u8)
4. Parse .m3u8 for media segment URLs
5. Download segments with Bearer token in header
```

### Client Headers (Anti-Bot Mimicry)

```javascript
const CLIENT_HEADERS = {
  'Authorization': `Bearer ${BEARER_TOKEN}`,
  'x-guest-token': guestToken,
  'x-twitter-active-user': 'yes',
  'x-twitter-auth-type': 'OAuth2Session',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://twitter.com/'
};
```

## Audio Stream Architecture

### Segment Structure

```
Space Audio is segmented into:
- Format: AAC in MP4 container (fragmented)
- Duration: 6-12 seconds per segment
- CDN: video.twimg.com or internal audio clusters
- Naming: UUID-based per Space
```

### FFmpeg Processing Pipeline

```bash
# Merge segments into single file
ffmpeg -i "concat:seg1.ts|seg2.ts|seg3.ts" \
       -c copy \
       -bsf:a aac_adtstoasc \
       output.m4a

# Convert to MP3
ffmpeg -i output.m4a \
       -codec:a libmp3lame \
       -q:a 2 \
       output.mp3

# Convert to WAV
ffmpeg -i output.m4a \
       -codec:a pcm_s16le \
       output.wav
```

## Data Models

### Space Metadata

```typescript
interface SpaceMetadata {
  id: string;
  title: string;
  host: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string;
  };
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  participantCount: number;
  speakers: Participant[];
  listeners: Participant[];
  status: 'live' | 'ended' | 'scheduled';
  thumbnailUrl?: string;
  streamUrl?: string; // HLS manifest
}
```

### Download Task

```typescript
interface DownloadTask {
  id: string;
  spaceId: string;
  spaceMetadata: SpaceMetadata;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputFormat: 'mp3' | 'wav' | 'm4a';
  outputPath: string;
  fileSize?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
```

## Security Architecture

### Token Storage

#### Web (Defense in Depth)

```
┌─────────────────────────────────────┐
│         Security Layering           │
├─────────────────────────────────────┤
│ 1. HttpOnly Cookie (primary)        │
│    - Can't be accessed by JS         │
│    - HTTPS only                      │
│    - SameSite=Strict                 │
├─────────────────────────────────────┤
│ 2. Encrypted localStorage (backup)   │
│    - AES-256-GCM encryption          │
│    - Key derived from session        │
├─────────────────────────────────────┤
│ 3. SessionStorage (ephemeral)       │
│    - Cleared on tab close           │
└─────────────────────────────────────┘
```

#### Android (Hardware-Backed Security)

```
┌─────────────────────────────────────┐
│      Android Keystore Chain          │
├─────────────────────────────────────┤
│ Level 1: AndroidKeyStore            │
│   - Hardware-backed when available   │
│   - Keys never exposed to app        │
├─────────────────────────────────────┤
│ Level 2: EncryptedSharedPreferences  │
│   - AES-256-GCM encrypted values     │
│   - Master key in Keystore          │
├─────────────────────────────────────┤
│ Level 3: In-Memory (runtime)        │
│   - Access token in memory only     │
│   - Never in logs or disk           │
└─────────────────────────────────────┘
```

## Rate Limiting Strategy

### Per-User Quota Management

```
Authenticated requests get higher limits:
- Guest: 100 requests/15min per endpoint
- User Auth: 1000 requests/15min per endpoint

Strategy:
1. Cache responses aggressively (Space metadata: 5 min TTL)
2. Batch requests when possible
3. Implement exponential backoff on 429
4. Use etags for conditional requests
```

## Component Architecture

### Backend Proxy Service

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.js          # OAuth endpoints
│   │   ├── spaces.js       # Space metadata proxy
│   │   └── download.js     # Stream processing
│   ├── services/
│   │   ├── twitter.js      # Twitter API client
│   │   ├── ffmpeg.js       # Audio processing
│   │   └── cache.js        # Response caching
│   ├── middleware/
│   │   ├── auth.js         # Token validation
│   │   ├── rateLimit.js    # Per-user limits
│   │   └── security.js     # Headers, CORS
│   └── utils/
│       ├── crypto.js       # Encryption utils
│       └── logger.js      # Audit logging
```

### Web Frontend

```
web/
├── src/
│   ├── components/
│   │   ├── LoginButton.jsx     # X OAuth trigger
│   │   ├── SpaceInput.jsx      # URL parser
│   │   ├── DownloadProgress.jsx
│   │   ├── DownloadHistory.jsx
│   │   └── UserProfile.jsx
│   ├── hooks/
│   │   ├── useAuth.js          # Auth state management
│   │   ├── useDownload.js      # Download operations
│   │   └── useSpaceMetadata.js
│   └── utils/
│       ├── api.js              # API client
│       ├── storage.js          # Secure storage
│       └── urlParser.js       # Space URL validation
```

### Android App

```
android/app/src/main/java/com/xspaces/downloader/
├── ui/
│   ├── screens/
│   │   ├── LoginScreen.kt
│   │   ├── HomeScreen.kt
│   │   ├── DownloadsScreen.kt
│   │   └── SettingsScreen.kt
│   ├── components/
│   │   ├── XLoginButton.kt
│   │   ├── SpaceUrlInput.kt
│   │   ├── DownloadCard.kt
│   │   └── ProgressIndicator.kt
│   └── theme/
│       └── Theme.kt
├── data/
│   ├── repository/
│   │   ├── AuthRepository.kt
│   │   ├── SpaceRepository.kt
│   │   └── DownloadRepository.kt
│   └── model/
│       ├── Space.kt
│       ├── DownloadTask.kt
│       └── User.kt
└── service/
    └── DownloadService.kt      # WorkManager + Foreground
```

## Compliance & Ethics

### X Developer Agreement Compliance

```
DO:
✓ Request only necessary scopes
✓ Respect user privacy
✓ Implement proper rate limiting
✓ Provide clear user consent
✓ Allow easy account disconnection
✓ Use official X login flow

DON'T:
✗ Store passwords or raw credentials
✗ Share tokens between users
✗ Scrape data without consent
✗ Violate rate limits aggressively
✗ Cache data indefinitely
✗ Bypass security measures
```

### Privacy Principles

```
1. Minimal Data Collection
   - Only fetch what we need
   - Don't store unnecessarily
   
2. User Control
   - Easy logout + data deletion
   - Transparent permissions

3. Secure Transmission
   - HTTPS only
   - Proper certificate validation
   
4. Token Security
   - Never log tokens
   - Rotate frequently
   - Clear on logout
```

## Error Handling Matrix

| Error Code | Meaning | User Message | Recovery |
|------------|---------|--------------|----------|
| 401 | Token expired | "Session expired. Please login again." | Auto-refresh or re-login |
| 403 | No permission | "Can't access this Space." | Check if Space is private |
| 404 | Space not found | "Space not found or deleted." | Validate URL |
| 429 | Rate limited | "Too many requests. Wait a moment." | Exponential backoff |
| 500 | Server error | "Something went wrong. Try again." | Retry with backoff |
| 503 | Unavailable | "X is temporarily unavailable." | Poll for recovery |
