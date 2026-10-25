package com.universal.location

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class EngineStatus { STOPPED, TRACKING, PERMISSION_DENIED, QUEUE_FULL }

/** Public SDK entry point; capture, durable queue and sync adapters plug into this API. */
class UniversalLocationEngine private constructor(
    val apiBaseUrl: String,
    val profile: TrackingProfile,
    private val queue: EventQueue,
    val locationCapturer: LocationCapturer?,
    val permissionManager: PermissionManager?,
    val connectivityMonitor: ConnectivityMonitor?,
) {
    private val status = MutableStateFlow(EngineStatus.STOPPED)
    private var uploadedEvents = 0L
    private var failedUploads = 0L
    val statusFlow: StateFlow<EngineStatus> = status.asStateFlow()

    fun startTracking() { status.value = EngineStatus.TRACKING }
    fun stopTracking() { status.value = EngineStatus.STOPPED }
    fun markPermissionDenied() { status.value = EngineStatus.PERMISSION_DENIED }
    fun markQueueFull() { status.value = EngineStatus.QUEUE_FULL }
    fun recordUploadResult(result: UploadResult) {
        when (result) {
            is UploadResult.Acknowledged -> uploadedEvents +=
                result.accepted.size + result.duplicates.size
            is UploadResult.RetryableFailure,
            is UploadResult.PermanentFailure -> failedUploads += 1
        }
    }
    fun requestFreshLocation() { /* host capture adapter will provide the event */ }
    fun recordEvent(event: LocationEvent): Boolean {
        val queued = queue.enqueue(event)
        if (!queued) status.value = EngineStatus.QUEUE_FULL
        return queued
    }

    fun diagnostics(): EngineDiagnostics = EngineDiagnostics(
        queuedEvents = queue.size(),
        oldestEventAt = queue.peek(1).firstOrNull()?.capturedAt,
        uploadedEvents = uploadedEvents,
        failedUploads = failedUploads,
    )

    class Builder {
        private var apiBaseUrl: String? = null
        private var profile = TrackingProfile.BALANCED
        private var queue: EventQueue = InMemoryEventQueue()
        private var locationCapturer: LocationCapturer? = null
        private var permissionManager: PermissionManager? = null
        private var connectivityMonitor: ConnectivityMonitor? = null

        fun apiBaseUrl(value: String) = apply { apiBaseUrl = value.trimEnd('/') }
        fun trackingProfile(value: TrackingProfile) = apply { profile = value }
        fun eventQueue(value: EventQueue) = apply { queue = value }
        /** Uses the persistent Room queue; callers should enqueue WorkManager sync after capture. */
        fun persistentQueue(context: Context, maxSize: Int = 10_000) = apply {
            queue = RoomEventQueue.create(context, maxSize)
        }
        fun locationCapturer(value: LocationCapturer) = apply { locationCapturer = value }
        fun permissionManager(value: PermissionManager) = apply { permissionManager = value }
        fun connectivityMonitor(value: ConnectivityMonitor) = apply { connectivityMonitor = value }
        fun build(): UniversalLocationEngine {
            val baseUrl = requireNotNull(apiBaseUrl) { "apiBaseUrl is required" }
            require(baseUrl.isNotBlank()) { "apiBaseUrl is required" }
            return UniversalLocationEngine(
                baseUrl,
                profile,
                queue,
                locationCapturer,
                permissionManager,
                connectivityMonitor,
            )
        }
    }
}
