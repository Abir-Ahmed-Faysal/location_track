package com.universal.location.demo

import android.content.Context
import android.content.SharedPreferences
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.universal.location.AndroidConnectivityMonitor
import com.universal.location.AndroidPermissionManager
import com.universal.location.ConnectivityState
import com.universal.location.EngineDiagnostics
import com.universal.location.EngineStatus
import com.universal.location.FusedLocationCapturer
import com.universal.location.HttpBatchUploader
import com.universal.location.LocationEvent
import com.universal.location.LocationSyncRuntime
import com.universal.location.LocationSyncWorker
import com.universal.location.LocationTrackingService
import com.universal.location.RoomEventQueue
import com.universal.location.SyncCoordinator
import com.universal.location.SyncWorkerDependencies
import com.universal.location.TrackingProfile
import com.universal.location.UniversalLocationEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.util.UUID

enum class FreshnessBadge { FRESH, DELAYED, STALE }

class MainViewModel : ViewModel() {

    private val PREFS_NAME = "ule_settings_prefs"
    private val KEY_API_URL = "api_base_url"
    private val KEY_DEVICE_ID = "device_id"
    private val KEY_AUTH_TOKEN = "auth_token"
    private val DEFAULT_PROD_URL = ""

    val apiBaseUrl = MutableStateFlow(DEFAULT_PROD_URL)
    val deviceId = MutableStateFlow("")
    val authToken = MutableStateFlow("")
    val trackingProfile = MutableStateFlow(TrackingProfile.BALANCED)

    private val _engine = MutableStateFlow<UniversalLocationEngine?>(null)

    private val _lastCapturedEvent = MutableStateFlow<LocationEvent?>(null)
    val lastCapturedEvent: StateFlow<LocationEvent?> = _lastCapturedEvent.asStateFlow()

    private val _diagnostics = MutableStateFlow(EngineDiagnostics(0, null, 0, 0))
    val diagnostics: StateFlow<EngineDiagnostics> = _diagnostics.asStateFlow()

    private val _engineStatus = MutableStateFlow(EngineStatus.STOPPED)
    val engineStatus: StateFlow<EngineStatus> = _engineStatus.asStateFlow()

    private val _connectivityState = MutableStateFlow(ConnectivityState.OFFLINE)
    val connectivityState: StateFlow<ConnectivityState> = _connectivityState.asStateFlow()

    val isTrackingServiceRunning: StateFlow<Boolean> = LocationTrackingService.isServiceRunning

    fun initEngine(context: Context) {
        val appContext = context.applicationContext
        val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        val savedUrl = prefs.getString(KEY_API_URL, DEFAULT_PROD_URL) ?: DEFAULT_PROD_URL
        val savedDeviceId = prefs.getString(KEY_DEVICE_ID, "") ?: ""
        val savedToken = prefs.getString(KEY_AUTH_TOKEN, "") ?: ""

        apiBaseUrl.value = savedUrl
        deviceId.value = savedDeviceId
        authToken.value = savedToken

        if (hasValidConfiguration()) applyEngineConfig(appContext)
    }

    fun saveAndApplyConfiguration(context: Context) {
        val appContext = context.applicationContext
        val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        prefs.edit()
            .putString(KEY_API_URL, apiBaseUrl.value.trim())
            .putString(KEY_DEVICE_ID, deviceId.value.trim())
            .putString(KEY_AUTH_TOKEN, authToken.value.trim())
            .apply()

        if (hasValidConfiguration()) {
            applyEngineConfig(appContext)
            Toast.makeText(appContext, "Configuration saved and applied", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(appContext, "Enter HTTPS API URL, device UUID, and access token", Toast.LENGTH_LONG).show()
        }
    }

    private fun applyEngineConfig(appContext: Context) {
        if (!hasValidConfiguration()) return
        val capturer = FusedLocationCapturer(appContext, deviceId.value)
        val permissions = AndroidPermissionManager(appContext)
        val connectivity = AndroidConnectivityMonitor(appContext)

        val previousConnectivity = _connectivityState.value
        _connectivityState.value = connectivity.state.value

        viewModelScope.launch {
            connectivity.state.collect { newState ->
                val oldState = _connectivityState.value
                _connectivityState.value = newState
                if (newState == ConnectivityState.ONLINE && oldState == ConnectivityState.OFFLINE) {
                    triggerManualSync(appContext)
                    refreshDiagnostics()
                }
            }
        }

        val roomQueue = RoomEventQueue.create(appContext)

        val engine = UniversalLocationEngine.Builder()
            .apiBaseUrl(apiBaseUrl.value)
            .trackingProfile(trackingProfile.value)
            .eventQueue(roomQueue)
            .locationCapturer(capturer)
            .permissionManager(permissions)
            .connectivityMonitor(connectivity)
            .build()

        LocationSyncRuntime.dependencies = SyncWorkerDependencies {
            val uploader = HttpBatchUploader(apiBaseUrl.value, authToken.value)
            val coordinator = SyncCoordinator(
                queue = roomQueue,
                uploader = uploader,
            )
            val result = coordinator.syncOnce()
            engine.recordUploadResult(result)
            result
        }

        _engine.value = engine
        _engineStatus.value = engine.statusFlow.value

        viewModelScope.launch {
            engine.statusFlow.collect { _engineStatus.value = it }
        }

        refreshDiagnostics()
    }

    private fun hasValidConfiguration(): Boolean =
        apiBaseUrl.value.startsWith("https://") &&
            runCatching { UUID.fromString(deviceId.value) }.isSuccess &&
            authToken.value.isNotBlank()

    fun startTracking(context: Context) {
        val engine = _engine.value ?: return
        val permissionManager = engine.permissionManager
        if (permissionManager != null &&
            !permissionManager.hasPermission(com.universal.location.LocationPermission.FINE) &&
            !permissionManager.hasPermission(com.universal.location.LocationPermission.COARSE)
        ) {
            Toast.makeText(context, "Grant location permission first", Toast.LENGTH_LONG).show()
            return
        }
        engine.startTracking()
        LocationTrackingService.start(context.applicationContext, engine)
        refreshDiagnostics()
    }

    fun stopTracking(context: Context) {
        val engine = _engine.value ?: return
        engine.stopTracking()
        LocationTrackingService.stop(context.applicationContext)
        refreshDiagnostics()
    }

    fun triggerManualSync(context: Context) {
        LocationSyncWorker.enqueue(context.applicationContext)
        refreshDiagnostics()
    }

    fun requestFreshLocation(context: Context? = null) {
        val engine = _engine.value ?: return
        viewModelScope.launch {
            val event = engine.locationCapturer?.requestFreshLocation()
            if (event != null) {
                engine.recordEvent(event)
                _lastCapturedEvent.value = event
            }
            if (context != null) {
                triggerManualSync(context)
            } else {
                refreshDiagnostics()
            }
        }
    }

    fun refreshDiagnostics() {
        viewModelScope.launch(Dispatchers.IO) {
            _diagnostics.value = _engine.value?.diagnostics() ?: EngineDiagnostics(0, null, 0, 0)
        }
    }

    fun calculateFreshness(capturedAt: Instant?): FreshnessBadge {
        if (capturedAt == null) return FreshnessBadge.STALE
        val ageSeconds = Duration.between(capturedAt, Instant.now()).seconds
        return when {
            ageSeconds <= 15 -> FreshnessBadge.FRESH
            ageSeconds in 16..60 -> FreshnessBadge.DELAYED
            else -> FreshnessBadge.STALE
        }
    }
}
