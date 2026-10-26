package com.universal.location.demo

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

enum class FreshnessBadge { FRESH, DELAYED, STALE }

class MainViewModel : ViewModel() {

    private val PREFS_NAME = "ule_settings_prefs"
    private val KEY_API_URL = "api_base_url"
    private val KEY_DEVICE_ID = "device_id"
    private val DEFAULT_PROD_URL = "https://ule-backend.onrender.com/api/v1"

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

    private var connectivityJob: Job? = null
    private var engineStatusJob: Job? = null
    private var approvalJob: Job? = null
    private val _adminSettingsUnlocked = MutableStateFlow(false)
    val adminSettingsUnlocked: StateFlow<Boolean> = _adminSettingsUnlocked.asStateFlow()
    private val _adminLoginMessage = MutableStateFlow<String?>(null)
    val adminLoginMessage: StateFlow<String?> = _adminLoginMessage.asStateFlow()

    fun loginAdmin(context: Context, emailInput: String, passwordInput: String) {
        val appContext = context.applicationContext
        if (!isValidApiUrl() || emailInput.isBlank() || passwordInput.isBlank()) {
            _adminLoginMessage.value = "Enter the administrator email and password."
            return
        }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).build()
                val body = Gson().toJson(mapOf("email" to emailInput.trim(), "password" to passwordInput))
                val loginRequest = Request.Builder()
                    .url("${apiBaseUrl.value.trimEnd('/')}/auth/login")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .header("bypass-tunnel-reminder", "true")
                    .build()
                val token = client.newCall(loginRequest).execute().use { response ->
                    if (!response.isSuccessful) return@use null
                    val json = Gson().fromJson(response.body?.string().orEmpty(), Map::class.java) as? Map<*, *>
                    json?.get("accessToken") as? String
                }
                if (token.isNullOrBlank()) {
                    _adminLoginMessage.value = "Administrator credentials were not accepted."
                    return@launch
                }
                val profileRequest = Request.Builder()
                    .url("${apiBaseUrl.value.trimEnd('/')}/auth/profile")
                    .get()
                    .header("Authorization", "Bearer $token")
                    .build()
                val role = client.newCall(profileRequest).execute().use { response ->
                    val json = Gson().fromJson(response.body?.string().orEmpty(), Map::class.java) as? Map<*, *>
                    json?.get("role") as? String
                }
                if (role == "ADMIN") {
                    _adminSettingsUnlocked.value = true
                    _adminLoginMessage.value = null
                } else {
                    _adminLoginMessage.value = "This account does not have administrator access."
                }
            } catch (e: Exception) {
                _adminLoginMessage.value = "Administrator login failed: ${e.message ?: "network error"}"
            }
        }
    }

    fun registerUser(context: Context, nameInput: String, emailInput: String, passwordInput: String) {
        val appContext = context.applicationContext
        if (!isValidApiUrl() || emailInput.isBlank() || passwordInput.length < 8) {
            Toast.makeText(appContext, "Enter a valid API URL, email, and password of at least 8 characters", Toast.LENGTH_LONG).show()
            return
        }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).build()
                val jsonBody = Gson().toJson(mapOf("name" to nameInput.trim(), "email" to emailInput.trim(), "password" to passwordInput))
                val request = Request.Builder()
                    .url("${apiBaseUrl.value.trimEnd('/')}/auth/signup")
                    .post(jsonBody.toRequestBody("application/json".toMediaType()))
                    .header("bypass-tunnel-reminder", "true")
                    .build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        if (BuildConfig.DEBUG) {
                            // Development builds may test multiple accounts on one phone.
                            assignNewEnrollmentDeviceId(appContext)
                        }
                        viewModelScope.launch(Dispatchers.Main) {
                            Toast.makeText(appContext, "Account created. Signing in and requesting device approval…", Toast.LENGTH_LONG).show()
                        }
                        loginUser(appContext, emailInput, passwordInput)
                    } else {
                        viewModelScope.launch(Dispatchers.Main) {
                            Toast.makeText(appContext, "Registration failed (${response.code}). Email may already be registered.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            } catch (e: Exception) {
                viewModelScope.launch(Dispatchers.Main) {
                    Toast.makeText(appContext, "Registration network error: ${e.message ?: "unknown error"}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    val isTrackingServiceRunning: StateFlow<Boolean> = LocationTrackingService.isServiceRunning

    fun initEngine(context: Context) {
        val appContext = context.applicationContext
        val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        val savedUrl = prefs.getString(KEY_API_URL, DEFAULT_PROD_URL) ?: DEFAULT_PROD_URL
        val savedDeviceId = getOrCreateDeviceId(appContext, prefs)
        val savedToken = SecureTokenStore(appContext).read().orEmpty()

        apiBaseUrl.value = savedUrl
        deviceId.value = savedDeviceId
        authToken.value = savedToken

        if (hasValidConfiguration()) {
            applyEngineConfig(appContext)
        }
    }

    fun saveAndApplyConfiguration(context: Context) {
        val appContext = context.applicationContext
        val prefs: SharedPreferences = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        prefs.edit()
            .putString(KEY_API_URL, apiBaseUrl.value.trim())
            .putString(KEY_DEVICE_ID, deviceId.value.trim())
            .apply()
        if (authToken.value.isBlank()) SecureTokenStore(appContext).clear()
        else SecureTokenStore(appContext).write(authToken.value.trim())

        if (hasValidConfiguration()) {
            applyEngineConfig(appContext)
            Toast.makeText(appContext, "Configuration saved and applied", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(
                appContext,
                "Enter a valid HTTPS API URL, device ID, and access token",
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    fun loginUser(context: Context, emailInput: String, passwordInput: String) {
        val appContext = context.applicationContext
        if (!isValidApiUrl() || emailInput.isBlank() || passwordInput.isBlank()) {
            Toast.makeText(appContext, "Enter a valid API URL, email, and password", Toast.LENGTH_LONG).show()
            return
        }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .build()
                val jsonBody = Gson().toJson(mapOf("email" to emailInput.trim(), "password" to passwordInput))
                val request = Request.Builder()
                    .url("${apiBaseUrl.value.trimEnd('/')}/auth/login")
                    .post(jsonBody.toRequestBody("application/json".toMediaType()))
                    .header("bypass-tunnel-reminder", "true")
                    .build()

                val response = client.newCall(request).execute()
                val responseStr = response.body?.string()
                if (response.isSuccessful && !responseStr.isNullOrBlank()) {
                    @Suppress("UNCHECKED_CAST")
                    val jsonObj = Gson().fromJson(responseStr, Map::class.java) as Map<String, Any>
                    val token = jsonObj["accessToken"] as? String
                    if (!token.isNullOrBlank()) {
                        val registration = registerDevice(client, token)
                        if (registration.approved) {
                            authToken.value = token
                            SecureTokenStore(appContext).write(token)
                            applyEngineConfig(appContext)
                            startTracking(appContext)
                            viewModelScope.launch(Dispatchers.Main) {
                                Toast.makeText(appContext, "Signed in and device linked successfully!", Toast.LENGTH_SHORT).show()
                            }
                        } else if (registration.status == "PENDING") {
                            SecureTokenStore(appContext).write(token)
                            approvalJob?.cancel()
                            approvalJob = viewModelScope.launch(Dispatchers.IO) {
                                while (true) {
                                    delay(10_000)
                                    val current = registerDevice(client, token)
                                    if (current.approved) {
                                        authToken.value = token
                                        applyEngineConfig(appContext)
                                        startTracking(appContext)
                                        launch(Dispatchers.Main) {
                                            Toast.makeText(appContext, "Device approved. Tracking is now active.", Toast.LENGTH_LONG).show()
                                        }
                                        break
                                    }
                                }
                            }
                            viewModelScope.launch(Dispatchers.Main) {
                                Toast.makeText(appContext, "Device enrollment pending admin approval.", Toast.LENGTH_LONG).show()
                            }
                        } else {
                            viewModelScope.launch(Dispatchers.Main) {
                                Toast.makeText(appContext, registration.message, Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                } else {
                    viewModelScope.launch(Dispatchers.Main) {
                        Toast.makeText(appContext, "Login failed: check email/password", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                viewModelScope.launch(Dispatchers.Main) {
                    Toast.makeText(appContext, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun registerDevice(client: OkHttpClient, token: String): RegistrationResult {
        return try {
            val jsonBody = Gson().toJson(
                mapOf("externalDeviceKey" to deviceId.value.trim(), "platform" to "ANDROID")
            )
            val request = Request.Builder()
                .url("${apiBaseUrl.value.trimEnd('/')}/devices/register")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .header("Authorization", "Bearer $token")
                .header("bypass-tunnel-reminder", "true")
                .build()
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string().orEmpty()
                    val json = Gson().fromJson(body, Map::class.java) as? Map<*, *>
                    RegistrationResult(json?.get("status") as? String, "")
                } else {
                    val body = response.body?.string().orEmpty()
                    val payload = Gson().fromJson(body, Map::class.java) as? Map<*, *>
                    val error = payload?.get("error") as? Map<*, *>
                    val serverMessage = error?.get("message") as? String
                    RegistrationResult(
                        null,
                        serverMessage ?: "Device link failed (${response.code}). Check the device ID and account.",
                    )
                }
            }
        } catch (e: Exception) {
            RegistrationResult(null, "Device link failed: ${e.message ?: "network error"}")
        }
    }

    private data class RegistrationResult(val status: String?, val message: String) {
        val approved: Boolean get() = status == "ACTIVE"
    }

    private fun getOrCreateDeviceId(
        appContext: Context,
        prefs: SharedPreferences,
    ): String {
        val saved = prefs.getString(KEY_DEVICE_ID, null)?.trim()
        if (!saved.isNullOrBlank() && saved != "device-android-001") return saved

        val androidId = Settings.Secure.getString(
            appContext.contentResolver,
            Settings.Secure.ANDROID_ID,
        )?.trim()
        val generated = if (!androidId.isNullOrBlank()) {
            "android-$androidId"
        } else {
            "android-${UUID.randomUUID()}"
        }
        prefs.edit().putString(KEY_DEVICE_ID, generated).apply()
        return generated
    }

    private fun assignNewEnrollmentDeviceId(appContext: Context) {
        val generated = "android-${UUID.randomUUID()}"
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_DEVICE_ID, generated)
            .apply()
        deviceId.value = generated
    }

    private fun applyEngineConfig(appContext: Context) {
        if (!hasValidConfiguration()) return
        connectivityJob?.cancel()
        engineStatusJob?.cancel()
        val capturer = FusedLocationCapturer(appContext, deviceId.value)
        val permissions = AndroidPermissionManager(appContext)
        val connectivity = AndroidConnectivityMonitor(appContext)

        _connectivityState.value = connectivity.state.value

        connectivityJob = viewModelScope.launch {
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

        engineStatusJob = viewModelScope.launch {
            engine.statusFlow.collect { _engineStatus.value = it }
        }

        refreshDiagnostics()
    }

    private fun isValidApiUrl(): Boolean = runCatching {
        val url = java.net.URI(apiBaseUrl.value.trim())
        url.scheme == "https" && !url.host.isNullOrBlank()
    }.getOrDefault(false)

    private fun hasValidConfiguration(): Boolean =
        isValidApiUrl() && deviceId.value.isNotBlank() && authToken.value.isNotBlank()

    private fun configuredEngine(context: Context): UniversalLocationEngine? {
        return _engine.value ?: run {
            Toast.makeText(
                context,
                "Configure and save the API URL, device ID, and access token first",
                Toast.LENGTH_LONG,
            ).show()
            null
        }
    }

    fun startTracking(context: Context) {
        val engine = configuredEngine(context) ?: return
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
        val engine = configuredEngine(context) ?: return
        engine.stopTracking()
        LocationTrackingService.stop(context.applicationContext)
        refreshDiagnostics()
    }

    fun triggerManualSync(context: Context) {
        if (configuredEngine(context) == null) return
        LocationSyncWorker.enqueue(context.applicationContext)
        refreshDiagnostics()
    }

    fun requestFreshLocation(context: Context? = null) {
        val engine = context?.let { configuredEngine(it) } ?: _engine.value ?: return
        viewModelScope.launch(Dispatchers.IO) {
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
