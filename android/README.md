# Android SDK and demo

This folder contains the Kotlin Android SDK library and its demo application. Open this directory in Android Studio to build and run them.

See [Android build setup](../docs/android-setup.md) for toolchain and host-app integration guidance.
# Universal Location Android demo

Open this directory (`android/`) in Android Studio. The older `sdk/android-location`
directory is a legacy scaffold, not the runnable demo.

## Required configuration

Before starting tracking, enter an HTTPS API base URL ending in `/api/v1`, a real
UUID returned by `POST /api/v1/devices/register`, and a non-expired access token
for the same account. Grant fine/coarse location permission. Background tracking
also requires the Android background-location flow and notification permission.

The app intentionally ships without a default server, token, or fake device ID.

## Build

Install JDK 17, Android SDK 35/36, and Gradle, then run:

```powershell
gradle wrapper --gradle-version 8.9
.\gradlew.bat :app:assembleDebug
```

The current repository environment has no JDK, Gradle, wrapper, or `adb`, so a
device build has not been verified here.
