# Android SDK build setup

The repository contains the Kotlin SDK under `android`. Room/SQLite
queue and WorkManager retry code are included, but the current development
machine does not have Java, Gradle, or an Android SDK, so Android verification is
still pending.

## Install

1. Install Android Studio with Android SDK Platform 35 and SDK Build Tools.
2. Install a JDK supported by the Android Gradle Plugin (JDK 17 is the safe default).
3. Open `android` in Android Studio and allow Gradle sync.
4. Generate or add the Gradle wrapper from the IDE/Gradle installation. The
   repository does not claim Android completion until the wrapper build passes.

## Verify

Run these commands from the `android/` directory:

```bash
java -version
./gradlew --version
./gradlew :android-location:build
```

On Windows PowerShell, use `gradlew.bat :android-location:build` after the wrapper
is present. The build must pass before claiming Android SDK completion.

## Process-wise integration

1. Open `android` in Android Studio and sync Gradle.
2. Run `:android-location:build` and fix any SDK/license prompts.
3. In the host app, provide `LocationCapturer`, `PermissionManager`, and
   `ConnectivityMonitor` adapters; the library intentionally does not choose a
   Google/Fused provider for every host application.
4. Build the engine with `.persistentQueue(context)` so events are stored in
   Room before upload.
5. Configure a `BatchUploader` for `/api/v1/locations/batch`. It must reuse each
   event ID and return `Acknowledged(accepted, duplicates)` only after the HTTP
   response confirms durable server acceptance.
6. Register `LocationSyncRuntime.dependencies` and enqueue
   `LocationSyncWorker` on capture/connectivity changes.
7. Test: permission denial, offline capture, process kill, device reboot,
   duplicate retry, API restart, and database/network failure. Verify queue rows
   remain until accepted/duplicate acknowledgement.
8. Run on a physical device before release; emulator location alone is not
   sufficient for background/Doze behavior.

## Remaining host-app work

The SDK supplies Room persistence and WorkManager orchestration. A host app still
must provide a real location provider adapter, runtime permission UI, network
uploader, foreground-service policy, and device-specific background-location
configuration. Keep the existing `EventQueue`, `BatchUploader`, `SyncCoordinator`,
and `RetryManager` contracts stable.
