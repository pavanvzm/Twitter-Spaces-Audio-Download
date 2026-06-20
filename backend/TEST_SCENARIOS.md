# X Spaces Audio Downloader - Test Scenarios

## Overview

This document defines 5 comprehensive test scenarios covering all major capabilities of the X Spaces Audio Downloader application. Tests are designed to be run under consistent conditions with clear pass/fail criteria.

---

## Success Criteria & Evaluation Method

### Scoring Rubric

| Grade | Score | Criteria |
|-------|-------|----------|
| **PASS** | 100% | All assertions pass, no errors |
| **PARTIAL** | 50-99% | Most assertions pass, minor issues |
| **FAIL** | 0-49% | Major functionality broken or non-functional |

### Evaluation Method

1. **Pass/Fail Checks**: Each scenario has specific assertions that must all pass for the scenario to be considered PASS
2. **Evidence Collection**: Each test run logs output, status codes, and response data
3. **Consistent Environment**: All tests run against the same backend instance with identical configuration

---

## Test Scenarios

### Scenario 1: OAuth Login Flow (PKCE Verification)

**Capability Tested**: Authentication system with OAuth 2.0 PKCE

**Prerequisites**:
- Backend server running
- Valid X OAuth credentials configured in environment

**Steps**:
1. Call `GET /api/auth/login` to initiate OAuth flow
2. Verify response contains `authUrl` with correct X OAuth parameters
3. Verify PKCE parameters (`code_challenge`, `code_challenge_method`) are present
4. Verify state token is generated and stored in session
5. Simulate callback with valid code (mocked for unit test)

**Success Criteria**:
- [ ] Login endpoint returns 200 status
- [ ] Response contains valid `authUrl` pointing to X OAuth
- [ ] PKCE `code_challenge` is SHA256 hash of `code_verifier`
- [ ] PKCE `code_challenge_method` is "S256"
- [ ] State token is cryptographically random
- [ ] Session is created with correct PKCE data

**Expected Response Structure**:
```json
{
  "success": true,
  "authUrl": "https://twitter.com/i/oauth2/authorize?...",
  "sessionId": "uuid-v4"
}
```

---

### Scenario 2: Space URL Parsing

**Capability Tested**: URL validation and Space ID extraction

**Steps**:
1. Test direct Space URL format: `https://twitter.com/i/spaces/1RDxlkAORPVJL`
2. Test x.com format: `https://x.com/i/spaces/1RDxlkAORPVJL`
3. Test invalid URL (should fail gracefully)
4. Test empty URL (should return 400)

**Success Criteria**:
- [ ] Direct twitter.com URL extracts correct Space ID
- [ ] x.com URL extracts correct Space ID  
- [ ] Invalid URL returns 400 with error code `INVALID_URL`
- [ ] Empty URL returns 400 with error code `URL_REQUIRED`
- [ ] Response includes supported URL formats in error message

**Test Cases**:
| Input URL | Expected Space ID | Expected Status |
|-----------|-------------------|-----------------|
| `https://twitter.com/i/spaces/1RDxlkAORPVJL` | `1RDxlkAORPVJL` | 200 |
| `https://x.com/i/spaces/abc123XYZ` | `abc123XYZ` | 200 |
| `https://invalid.com/spaces/123` | null | 400 |
| `https://twitter.com/status/123/spaces` | null | 400 |
| `""` (empty) | null | 400 |

---

### Scenario 3: Space Metadata Fetching (Guest Token + GraphQL)

**Capability Tested**: Guest token acquisition and internal GraphQL API

**Steps**:
1. Fetch guest token from `/1.1/guest/activate.json`
2. Call Space metadata endpoint with guest token
3. Verify GraphQL response is properly parsed
4. Verify response matches expected SpaceMetadata interface

**Success Criteria**:
- [ ] Guest token is acquired successfully
- [ ] GraphQL request uses correct query ID and variables
- [ ] Response is properly parsed into SpaceMetadata format
- [ ] Response includes: id, title, host, status, participants
- [ ] Cache is used for repeated requests
- [ ] 404 returned for non-existent Space

**Mock/Unit Test Approach**:
- Mock the GraphQL response for Space data
- Verify correct headers are sent (Bearer token, guest token)
- Verify error handling for 401/403/429 responses

---

### Scenario 4: Audio Download Pipeline (M3U8 Parsing + FFmpeg)

**Capability Tested**: HLS manifest parsing and audio processing

**Steps**:
1. Parse master M3U8 manifest (select highest quality variant)
2. Parse variant M3U8 manifest (extract segment URLs)
3. Download audio segments with proper headers
4. Merge segments using FFmpeg concat
5. Convert to target format (MP3/WAV/M4A)

**Success Criteria**:
- [ ] Master manifest parsing extracts all variants
- [ ] Highest bandwidth variant is selected
- [ ] All segment URLs are correctly resolved
- [ ] Segments download with proper Authorization headers
- [ ] FFmpeg merge completes without errors
- [ ] Format conversion produces valid output file
- [ ] Progress callback is invoked correctly

**Test Data** (Mocked):
```javascript
const mockManifest = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000
variant_low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000
variant_high.m3u8
`;

const mockVariant = `
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:9.9,
segment1.aac
#EXTINF:10.0,
segment2.aac
#EXT-X-ENDLIST
`;
```

---

### Scenario 5: Rate Limiting

**Capability Tested**: Per-endpoint rate limits and proper HTTP 429 responses

**Steps**:
1. Make requests to Spaces API up to limit (200/15min)
2. Verify requests succeed until limit reached
3. Verify 429 response after limit exceeded
4. Verify retry-after header is present
5. Verify different endpoints have different limits

**Success Criteria**:
- [ ] Auth endpoints: 20 requests/15min enforced
- [ ] Spaces endpoints: 200 requests/15min enforced  
- [ ] Download endpoints: 10 requests/hour enforced
- [ ] 429 response includes error code and retry information
- [ ] Rate limit uses session token when available, IP fallback
- [ ] Standard headers (RateLimit-*) are present in response

**Rate Limit Matrix**:
| Endpoint | Window | Max Requests | Enforced |
|----------|--------|--------------|----------|
| `/api/auth/*` | 15 min | 20 | ✓ |
| `/api/spaces/*` | 15 min | 200 | ✓ |
| `/api/download/*` | 1 hour | 10 | ✓ |
| General | 15 min | 500-1000 | ✓ |

---

## Test Execution Protocol

### Pre-Test Setup

```bash
# 1. Install dependencies
cd backend && npm install

# 2. Set environment variables
export X_BEARER_TOKEN="test_bearer_token"
export X_CLIENT_ID="test_client_id"
export X_CLIENT_SECRET="test_client_secret"

# 3. Start backend server
npm start &
```

### Test Run Sequence

1. **Run all scenarios sequentially**
2. **Document each outcome with evidence**
3. **Fix failures before proceeding**
4. **Re-run failed scenarios after fixes**
5. **Final validation of complete suite**

### Evidence Collection

For each test run, record:
- Timestamp
- Scenario name
- Input parameters
- HTTP status codes
- Response body (sanitized)
- Pass/Fail status
- Error messages (if any)

---

## Acceptance Criteria

**All 5 scenarios must achieve PASS status (100%) for the test suite to be considered complete.**

If any scenario fails:
1. Document the failure with evidence
2. Identify root cause
3. Implement fix
4. Re-run affected scenario
5. Re-run complete suite to verify no regressions

---

## Test Framework

Tests are implemented using **Jest** for the backend with the following structure:

```
backend/
├── tests/
│   ├── scenarios/
│   │   ├── scenario1-oauth.test.js
│   │   ├── scenario2-url-parsing.test.js
│   │   ├── scenario3-metadata-fetching.test.js
│   │   ├── scenario4-audio-pipeline.test.js
│   │   └── scenario5-rate-limiting.test.js
│   ├── setup.js
│   └── mocks/
│       ├── twitter-api.js
│       └── ffmpeg.js
└── package.json
```
