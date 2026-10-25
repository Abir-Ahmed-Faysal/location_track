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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

enum class FreshnessBadge { FRESH, DELAYED, STALE }

class MainViewModel : ViewModel() {

    private val PREFS_NAME = "ule_settings_prefs"
    private val KEY_API_URL = "api_base_url"
    private val KEY_DEVICE_ID = "device_id"
    private val KEY_AUTH_TOKEN = "auth_token"

    val apiBaseUrl = MutableStateFlow("http://10.0.2.2:5000/api/v1")
    val deviceId = MutableStateFlow("device-android-001")
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

        val savedUrl = prefs.getString(KEY_API_URL, "http://10.0.2.2:5000/api/v1") ?: "http://10.0.2.2:5000/api/v1"
        val savedDeviceId = prefs.getString(KEY_DEVICE_ID, "device-android-001") ?: "device-android-001"
        val savedToken = prefs.getString(KEY_AUTH_TOKEN, "") ?: ""

        apiBaseUrl.value = savedUrl
        deviceId.value = savedDeviceId
        authToken.value = savedToken

        applyEngineConfig(appContext)
    }

    fun saveAndApplyConfiguration(context: Context) {
        val appContext = context.applicationContext
        val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        prefs.edit()
            .putString(KEY_API_URL, apiBaseUrl.value.trim())
            .putString(KEY_DEVICE_ID, deviceId.value.trim())
            .putString(KEY_AUTH_TOKEN, authToken.value.trim())
            .apply()

        applyEngineConfig(appContext)
        Toast.makeText(appContext, "Configuration Saved & Applied!", Toast.LENGTH_SHORT).show()
    }

    private fun applyEngineConfig(appContext: Context) {
        val capturer = FusedLocationCapturer(appContext, deviceId.value)
        val permissions = AndroidPermissionManager(appContext)
        val connectivity = AndroidConnectivityMonitor(appContext)

        _connectivityState.value = connectivity.state.value
        viewModelScope.launch {
            connectivity.state.collect { _connectivityState.value = it }
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

    fun startTracking(context: Context) {
        val engine = _engine.value ?: return
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

    fun requestFreshLocation() {
        val engine = _engine.value ?: return
        viewModelScope.launch {
            val event = engine.locationCapturer?.requestFreshLocation()
            if (event != null) {
                engine.recordEvent(event)
                _lastCapturedEvent.value = event
            }
            refreshDiagnostics()
        }
    }

    fun refreshDiagnostics() {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
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
