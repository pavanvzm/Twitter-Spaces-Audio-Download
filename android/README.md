# X Spaces Downloader - Android App

Native Android application for downloading X (Twitter) Spaces audio recordings.

## Features

- **Native Android UI** built with Jetpack Compose
- **Direct API Integration** - fetches Space metadata from Twitter API
- **Modern Architecture** - MVVM with Hilt dependency injection
- **Material Design 3** - clean, modern interface
- **Background Downloads** - download audio files in the background
- **Share Functionality** - share downloaded audio via Android share sheet

## Architecture

```
com.xspaces.downloader/
├── data/
│   ├── model/          # Data classes (Space, DownloadTask, etc.)
│   └── repository/     # Data repositories
├── di/                 # Hilt dependency injection modules
└── ui/
    ├── components/     # Reusable UI components
    ├── navigation/     # Navigation setup
    ├── screens/        # Screen composables & ViewModels
    └── theme/          # Material theme
```

## Tech Stack

- **Kotlin** - Primary language
- **Jetpack Compose** - Modern declarative UI
- **Hilt** - Dependency injection
- **Kotlin Coroutines** - Async operations
- **Retrofit** - Network calls (for backend API)
- **DataStore** - Local preferences storage

## API Integration

The app connects to Twitter's GraphQL API to fetch Space metadata:

1. **Guest Token** - Obtains a guest token for API access
2. **GraphQL Query** - Queries `AudioSpaceById` with Space ID
3. **Response Parsing** - Extracts title, host, speakers, stream URL
4. **Download** - Downloads audio via backend or direct URL

## Building

### Prerequisites

- JDK 17+
- Android SDK (API 34)
- Gradle 8+

### Quick Build

```bash
# Clone repository
git clone https://github.com/your-repo/Twitter-Spaces-Audio-Download.git
cd Twitter-Spaces-Audio-Download

# Build debug APK
cd android
./build.sh

# Or directly with Gradle
./gradlew assembleDebug
```

### Output

APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Using Docker

```bash
docker-compose up android-builder
```

## Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
    android:maxSdkVersion="28" />
```

## Screens

1. **Home Screen** - Paste Space URL, validate, see info
2. **Downloads Screen** - View download history
3. **Settings Screen** - Configure format, quality

## Troubleshooting

### "Failed to get guest token"
- X may be blocking API requests
- Try again later or use web app

### "Recording not available"
- Space may still be live
- Host may have disabled recordings
- Space may be private

### APK won't install
- Enable "Install from unknown sources" in Android settings
- Ensure sufficient storage space

## License

Same as main project - MIT License
