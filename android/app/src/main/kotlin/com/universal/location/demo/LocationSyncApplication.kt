package com.universal.location.demo

import android.app.Application
import com.universal.location.AndroidConnectivityMonitor
import com.universal.location.AndroidPermissionManager
import com.universal.location.FusedLocationCapturer
import com.universal.location.HttpBatchUploader
import com.universal.location.LocationEngineFactory
import com.universal.location.LocationSyncRuntime
import com.universal.location.LocationTrackingRuntime
import com.universal.location.LocationHeartbeatSenderFactory
import com.universal.location.LocationHeartbeatRuntime
import com.universal.location.RoomEventQueue
import com.universal.location.SyncCoordinator
import com.universal.location.SyncWorkerDependencies
import com.universal.location.SyncWorkerDependenciesFactory
import com.universal.location.TrackingProfile
import com.universal.location.UniversalLocationEngine

/** Registers process-recoverable WorkManager sync dependencies for the demo app. */
class LocationSyncApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        LocationTrackingRuntime.engineFactory = LocationEngineFactory { context ->
            createEngine(context)
        }
        LocationSyncRuntime.dependenciesFactory = SyncWorkerDependenciesFactory { context ->
            createSyncDependencies(context)
        }
        LocationHeartbeatRuntime.senderFactory = LocationHeartbeatSenderFactory { context ->
            val config = readConfig(context)
            config?.let { HeartbeatClient(context, it.apiUrl, it.deviceId) }
        }
    }

    private fun createEngine(context: android.content.Context): UniversalLocationEngine? {
        val config = readConfig(context) ?: return null
        val queue = RoomEventQueue.create(context)
        return UniversalLocationEngine.Builder()
            .apiBaseUrl(config.apiUrl)
            .trackingProfile(TrackingProfile.BALANCED)
            .eventQueue(queue)
            .locationCapturer(FusedLocationCapturer(context, config.deviceId))
            .permissionManager(AndroidPermissionManager(context))
            .connectivityMonitor(AndroidConnectivityMonitor(context))
            .build()
    }

    private fun createSyncDependencies(context: android.content.Context): SyncWorkerDependencies? {
        val config = readConfig(context) ?: return null
        val queue = RoomEventQueue.create(context)
        val authSession = AuthSession(context, config.apiUrl)
        return SyncWorkerDependencies {
            SyncCoordinator(
                queue,
                HttpBatchUploader(
                    apiBaseUrl = config.apiUrl,
                    authToken = config.authToken,
                    currentAccessToken = authSession::accessToken,
                    refreshAccessToken = { authSession.refreshAccessToken() },
                ),
            ).syncOnce()
        }
    }

    private fun readConfig(context: android.content.Context): SyncConfig? {
        val preferences = context.getSharedPreferences(PREFERENCES, MODE_PRIVATE)
        val apiUrl = preferences.getString(API_URL_KEY, null)?.trim().orEmpty()
        val deviceId = preferences.getString(DEVICE_ID_KEY, null)?.trim().orEmpty()
        val authToken = SecureTokenStore(context).read()?.trim().orEmpty()
        if (!apiUrl.startsWith("https://") || deviceId.isBlank() || authToken.isBlank()) {
            return null
        }
        return SyncConfig(apiUrl, deviceId, authToken)
    }

    private data class SyncConfig(val apiUrl: String, val deviceId: String, val authToken: String)

    companion object {
        const val PREFERENCES = "ule_settings_prefs"
        const val API_URL_KEY = "api_base_url"
        const val DEVICE_ID_KEY = "device_id"
    }
}
