# Android Build Environment
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Java and Android SDK
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    wget \
    unzip \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Download Android SDK command line tools
RUN wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d /opt/android-sdk && \
    mv /opt/android-sdk/cmdline-tools /opt/android-sdk/cmdline-tools-temp && \
    mkdir -p /opt/android-sdk/cmdline-tools && \
    mv /opt/android-sdk/cmdline-tools-temp /opt/android-sdk/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

# Set Android SDK environment
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Accept licenses and install required SDK components
RUN yes | sdkmanager --licenses || true
RUN sdkmanager --install "platforms;android-34" "build-tools;34.0.0" "platform-tools" 2>/dev/null || true

# Copy project files
WORKDIR /app
COPY . .

# Build the debug APK
CMD ["./gradlew", "assembleDebug"]
