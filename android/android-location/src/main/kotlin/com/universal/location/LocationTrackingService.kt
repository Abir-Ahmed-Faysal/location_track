package com.universal.location

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

class LocationTrackingService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private var captureJob: Job? = null
    private var heartbeatJob: Job? = null
    @Volatile private var lastLocationCapturedAt = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            startForeground(NOTIFICATION_ID, notification, type)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        _isServiceRunning.value = true

        val engine = activeEngine ?: LocationTrackingRuntime.engineFactory
            ?.create(applicationContext)
            ?.also { activeEngine = it }
        if (engine?.locationCapturer == null) {
            stopForeground(true)
            _isServiceRunning.value = false
            stopSelf()
            return START_NOT_STICKY
        }
        captureJob?.cancel()
        captureJob = serviceScope.launch {
            while (isActive) {
                try {
                    engine.locationCapturer.locations(engine.profile).collect { locationEvent ->
                        lastLocationCapturedAt = System.currentTimeMillis()
                        _latestLocation.value = locationEvent
                        engine.recordEvent(locationEvent)
                        LocationSyncWorker.enqueue(applicationContext)
                    }
                } catch (_: Exception) {
                    if (isActive) delay(CAPTURE_RESTART_DELAY_MS)
                }
            }
        }

        heartbeatJob?.cancel()
        val heartbeatSender = LocationHeartbeatRuntime.senderFactory?.create(applicationContext)
        if (heartbeatSender != null) {
            heartbeatJob = serviceScope.launch {
                while (isActive) {
                    val elapsed = System.currentTimeMillis() - lastLocationCapturedAt
                    if (lastLocationCapturedAt == 0L || elapsed >= HEARTBEAT_INTERVAL_MS) {
                        try {
                            heartbeatSender.send()
                        } catch (_: Exception) {
                            // Keep the tracking service alive; the next interval retries the heartbeat.
                        }
                    }
                    delay(HEARTBEAT_INTERVAL_MS)
                }
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        captureJob?.cancel()
        heartbeatJob?.cancel()
        super.onDestroy()
        serviceScope.cancel()
        _isServiceRunning.value = false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Ongoing location tracking notification"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Universal Location Engine")
            .setContentText("Location tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "location_tracking_channel"
        const val NOTIFICATION_ID = 1001
        private const val HEARTBEAT_INTERVAL_MS = 180_000L
        private const val CAPTURE_RESTART_DELAY_MS = 5_000L

        private val _isServiceRunning = MutableStateFlow(false)
        val isServiceRunning: StateFlow<Boolean> = _isServiceRunning.asStateFlow()
        private val _latestLocation = MutableStateFlow<LocationEvent?>(null)
        val latestLocation: StateFlow<LocationEvent?> = _latestLocation.asStateFlow()

        @Volatile var activeEngine: UniversalLocationEngine? = null

        fun start(context: Context, engine: UniversalLocationEngine) {
            activeEngine = engine
            val intent = Intent(context, LocationTrackingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, LocationTrackingService::class.java)
            context.stopService(intent)
            activeEngine = null
        }
    }
}

/** Process-recreation hook used by host applications to rebuild the tracking engine. */
fun interface LocationEngineFactory {
    fun create(context: Context): UniversalLocationEngine?
}

object LocationTrackingRuntime {
    @Volatile var engineFactory: LocationEngineFactory? = null
}
