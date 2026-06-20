#!/bin/bash
# Build script for X Spaces Downloader Android App
# 
# Prerequisites:
# 1. Java JDK 17+
# 2. Android SDK (with API 34)
# 3. Gradle (or use gradlew wrapper)
#
# Quick Setup:
# - Install Java: https://adoptium.net/
# - Install Android SDK: https://developer.android.com/studio
# - Or use the Dockerfile: docker-compose up android-builder

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "X Spaces Downloader - Android Build"
echo "=========================================="

# Check Java
if ! command -v java &> /dev/null; then
    echo "Error: Java not found. Please install JDK 17+"
    echo "Download from: https://adoptium.net/"
    exit 1
fi

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "Warning: ANDROID_HOME not set. Android SDK may not be found."
    echo "Set it with: export ANDROID_HOME=/path/to/android/sdk"
fi

# Create local.properties if not exists
if [ ! -f "local.properties" ]; then
    echo "sdk.dir=${ANDROID_HOME:-/opt/android-sdk}" > local.properties
fi

# Build debug APK
echo "Building debug APK..."
./gradlew clean assembleDebug --no-daemon

# Find the APK
APK=$(find app/build/outputs/apk/debug -name "*.apk" 2>/dev/null | head -1)

if [ -f "$APK" ]; then
    echo ""
    echo "=========================================="
    echo "✓ Build successful!"
    echo "=========================================="
    echo "APK Location: $(realpath $APK)"
    echo "APK Size: $(du -h $APK | cut -f1)"
else
    echo "Error: APK not found after build"
    exit 1
fi
