# X Spaces Audio Downloader

A cross-platform application (Web + Android) that allows users to download complete recordings of X Spaces by pasting the Space URL. Uses X's guest token system - **no X account or developer credentials required**.

## Features

- **No Login Required**: Uses X's guest token system for instant access
- **Space URL Parsing**: Support for various X Space URL formats (twitter.com/x.com)
- **Audio Download**: Download Space recordings in MP3, WAV, or M4A formats
- **Progress Tracking**: Real-time download progress with status updates
- **Library Management**: View and manage download history
- **Metadata Extraction**: Automatically fetch Space title, host, and participant info

## Architecture

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
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
Twitter-Spaces-Audio-Download/
├── backend/                    # Node.js proxy service
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   ├── middleware/          # Express middleware
│   │   └── utils/              # Utilities
│   └── package.json
├── web/                        # React web application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   └── utils/              # Utilities
│   └── package.json
├── android/                    # Android application
│   └── app/src/main/java/
│       └── com/xspaces/downloader/
│           ├── ui/             # Compose UI
│           ├── data/            # Repositories & models
│           └── service/        # Background services
├── ARCHITECTURE.md             # Detailed architecture docs
├── SECURITY_COMPLIANCE.md       # Security & compliance info
└── README.md                   # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- FFmpeg (for audio processing)
- X Developer Account (for OAuth credentials)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables:
   ```
   PORT=3001
   NODE_ENV=development
   X_CLIENT_ID=your_client_id
   X_CLIENT_SECRET=your_client_secret
   OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
   ```

5. Start the server:
   ```bash
   npm start
   ```

### Web Application Setup

1. Navigate to web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure API URL (if not using default):
   ```bash
   echo "VITE_API_URL=http://localhost:3001/api" > .env
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Android Application Setup

1. Open Android Studio

2. Import the `android` directory

3. Configure OAuth credentials in `AuthRepository.kt`:
   ```kotlin
   private const val CLIENT_ID = "your_x_client_id"
   ```

4. Build and run on device/emulator

## API Endpoints

### Authentication
- `GET /api/auth/login` - Initiate OAuth flow
- `POST /api/auth/callback` - Handle OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and revoke tokens

### Spaces
- `GET /api/spaces/:id` - Get Space metadata
- `GET /api/spaces/:id/audio` - Get audio stream URL
- `POST /api/spaces/parse` - Parse Space URL

### Downloads
- `POST /api/download/start` - Start download task
- `GET /api/download/:taskId` - Get download status
- `GET /api/download/:taskId/file` - Download completed file
- `DELETE /api/download/:taskId` - Cancel/delete download

## Security

This project implements:

- OAuth 2.0 PKCE authentication flow
- Secure token storage (HttpOnly cookies, Android Keystore)
- Rate limiting per user/IP
- Input validation and sanitization
- No credential logging
- HTTPS enforcement

See [SECURITY_COMPLIANCE.md](./SECURITY_COMPLIANCE.md) for detailed security documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is provided for educational purposes. Users are responsible for complying with X's Terms of Service when using this application.

## Disclaimer

This application is designed for **personal use only**. Downloading Space recordings may be subject to copyright. The developers are not responsible for misuse of this application.
