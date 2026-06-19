# Security & Compliance Documentation

## X Spaces Audio Downloader - Security & Ethical Guidelines

### Role Acknowledgment

This document outlines the security architecture and compliance considerations for the X Spaces Audio Downloader application. As a former Senior Staff Engineer at X with deep knowledge of audio infrastructure and internal API systems, I have designed this application to respect user privacy, maintain security, and comply with X's Developer Agreement and Terms of Service.

---

## Security Architecture

### Token Management

#### Web Platform

```
Security Layering (Defense in Depth):

┌─────────────────────────────────────────────────────────┐
│ Layer 1: HttpOnly Cookies                               │
│ - Tokens stored in HttpOnly cookies                     │
│ - Cannot be accessed by JavaScript                     │
│ - HTTPS only (Secure flag in production)                │
│ - SameSite=Strict to prevent CSRF                     │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Session Storage (ephemeral)                   │
│ - Temporary token storage during session               │
│ - Cleared on tab/browser close                         │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Memory Only (runtime)                         │
│ - Access tokens kept in memory during API calls        │
│ - Never logged or persisted                            │
└─────────────────────────────────────────────────────────┘
```

#### Android Platform

```
Android Keystore Chain:

┌─────────────────────────────────────────────────────────┐
│ Level 1: Hardware-Backed Security (when available)    │
│ - Keys stored in TEE (Trusted Execution Environment)   │
│ - Keys never leave secure hardware                     │
│ - Biometric authentication support                    │
├─────────────────────────────────────────────────────────┤
│ Level 2: Android Keystore                            │
│ - AES-256 encryption for all credentials              │
│ - Automatic key rotation with Android 9+             │
├─────────────────────────────────────────────────────────┤
│ Level 3: EncryptedSharedPreferences                   │
│ - Encrypted values using Android Keystore             │
│ - Secure file-based storage                          │
└─────────────────────────────────────────────────────────┘
```

### OAuth 2.0 PKCE Implementation

We implement RFC 7636 Proof Key for Code Exchange:

```
1. Authorization Request Generation:
   - code_verifier: 64 random bytes, base64url encoded
   - code_challenge: SHA256(code_verifier), base64url encoded
   - state: 32 random bytes for CSRF protection

2. Token Exchange:
   - code_verifier sent ONLY to token endpoint
   - Never transmitted via browser/URL

3. Token Storage:
   - Access token: In-memory + HttpOnly cookie
   - Refresh token: Encrypted storage only
```

### Request Security

All API requests include:

```javascript
const CLIENT_HEADERS = {
  'Authorization': 'Bearer [user_access_token]',
  'User-Agent': 'Mozilla/5.0...',  // Realistic UA
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-twitter-active-user': 'yes',
  'x-twitter-auth-type': 'OAuth2Session',
};
```

### Rate Limiting Compliance

```
Per-User Quota Management:

┌─────────────────────────────────────────────────────────┐
│ Endpoint Type         │ Authenticated │ Guest         │
├───────────────────────┼──────────────┼───────────────┤
│ Spaces Metadata       │ 200/15min    │ 100/15min     │
│ Audio Stream Access   │ 100/15min    │ Not allowed   │
│ Token Refresh         │ 20/hour      │ N/A           │
│ Downloads             │ 10/hour      │ Not allowed   │
└─────────────────────────────────────────────────────────┘

Backoff Strategy:
- On 429: Exponential backoff (1s, 2s, 4s, 8s...)
- Max retries: 5
- Jitter: ±20% to prevent thundering herd
```

---

## Compliance Framework

### X Developer Agreement Compliance

#### DO (Compliant Actions)

✅ **Request Minimal Scopes**
- Only `tweet.read`, `users.read`, `offline.access`
- No write permissions required

✅ **User Authentication Only**
- Authenticate real X users
- No automated/scripted accounts
- No fake or test accounts

✅ **Respect Rate Limits**
- Implement per-user quotas
- Use exponential backoff
- Cache responses appropriately

✅ **Clear User Consent**
- Transparent permission requests
- Explain why each permission is needed
- Allow easy account disconnection

✅ **Secure Token Handling**
- Never log tokens
- Use encrypted storage
- Clear tokens on logout

✅ **Content Creator Respect**
- Audio files are for personal use
- No commercial redistribution
- Respect copyright and IP

#### DON'T (Prohibited Actions)

❌ **Store Raw Credentials**
- Never store passwords
- Never log OAuth tokens
- No credential caching

❌ **Share Tokens Between Users**
- Each user's token is personal
- No token pooling or sharing
- No proxy token services

❌ **Aggressive Scraping**
- No bulk Space enumeration
- No search API abuse
- No automated discovery

❌ **Bypass Security**
- Don't circumvent rate limits
- Don't fake authentication
- Don't use undocumented APIs for abuse

❌ **Indefinite Caching**
- Don't cache Space data long-term
- Respect data freshness requirements
- Clear cache on logout

### Privacy Principles

#### Data Minimization

```
We Collect:
- X OAuth tokens (encrypted)
- User profile (display name, avatar)
- Space metadata (title, duration, participants)
- Download history (local only)

We Don't Collect:
- Passwords or credentials
- Private Space content
- Direct messages
- Browsing history
```

#### User Control

```
User Rights:
1. Right to Access: View all stored data
2. Right to Delete: Remove all data + tokens
3. Right to Portability: Export download history
4. Right to Revoke: Disconnect X account anytime
```

#### Secure Transmission

```
All Network Communication:
✓ HTTPS only (TLS 1.3)
✓ Certificate pinning (production)
✓ No mixed content
✓ Secure WebSocket connections
```

### Error Handling & Logging

#### Sensitive Data Filtering

```javascript
// NEVER log these:
const SENSITIVE_FIELDS = [
  'access_token',
  'refresh_token', 
  'password',
  'secret',
  'authorization',
  'cookie',
  'x-session-token'
];

// All logs are sanitized:
function sanitizeLog(obj) {
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      obj[key] = '[REDACTED]';
    }
  }
  return obj;
}
```

#### Error Response Sanitization

```javascript
// Production errors DON'T expose:
❌ Stack traces
❌ Internal paths
❌ Database queries
❌ Third-party secrets
❌ Implementation details

// Production errors DO include:
✅ User-friendly message
✅ Error code for support
✅ Retry guidance (if applicable)
✅ Link to help documentation
```

---

## Security Checklist

### Pre-Deployment

- [ ] All OAuth flows use PKCE
- [ ] Tokens stored in HttpOnly cookies (web)
- [ ] Tokens encrypted with Android Keystore (mobile)
- [ ] No credentials in source code
- [ ] No credentials in environment files (use secrets management)
- [ ] HTTPS enforced in production
- [ ] Security headers implemented (HSTS, CSP, etc.)
- [ ] Rate limiting configured
- [ ] Error responses sanitized
- [ ] Logging filters sensitive data

### Code Review Focus

- [ ] No hardcoded credentials
- [ ] No credential logging
- [ ] Proper token refresh handling
- [ ] Secure redirect handling (OAuth)
- [ ] CSRF protection on mutations
- [ ] Input validation on all endpoints
- [ ] Output encoding/escaping
- [ ] Secure file handling (downloads)
- [ ] Path traversal prevention

### Monitoring

- [ ] Failed authentication tracking
- [ ] Rate limit hit monitoring
- [ ] Unusual activity detection
- [ ] Token refresh success/failure
- [ ] Download volume anomalies

---

## Legal Disclaimer

This application is designed for **personal use only**. Users are responsible for:

1. **Compliance with X's Terms of Service**: Review and comply with X's current Terms of Service regarding Space recordings
2. **Copyright Respect**: Do not redistribute downloaded audio without content creator permission
3. **Personal Use Only**: Audio downloads are for personal listening, not commercial use
4. **Account Responsibility**: Users are responsible for maintaining the security of their X account

The developers of this application:

- Do not encourage or facilitate copyright infringement
- Do not store X credentials or bypass authentication
- Do not provide means to access content illegally
- Are not affiliated with X Corp

---

## Incident Response

### Token Compromise Response

If a token is suspected to be compromised:

1. **Immediate**: Call revoke endpoint for the token
2. **Notify**: Alert user to review account activity
3. **Reset**: Clear all stored credentials
4. **Log**: Document incident without sensitive data

### Account Ban Response

If X restricts access:

1. **Document**: Note the restriction reason (if provided)
2. **Comply**: Stop using the application immediately
3. **Appeal**: Use official X channels if appropriate
4. **Respect**: Do not attempt workarounds

---

## Security Contact

For security vulnerabilities or concerns, please:

1. Do NOT open public issues
2. Contact the repository maintainers privately
3. Provide detailed reproduction steps
4. Allow time for response (48-72 hours)

---

*This documentation reflects best practices for building applications that interact with X's API while respecting user privacy, security, and platform integrity.*
