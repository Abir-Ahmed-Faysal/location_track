package com.universal.location.demo

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.universal.location.LocationTrackingRuntime
import com.universal.location.LocationTrackingService

/** Restores explicitly enabled tracking after the device has rebooted. */
class TrackingBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED ||
            !TrackingSettings.isTrackingEnabled(context) ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) return

        val engine = LocationTrackingRuntime.engineFactory?.create(context.applicationContext)
        if (engine != null) {
            runCatching { LocationTrackingService.start(context.applicationContext, engine) }
        }
    }
}
