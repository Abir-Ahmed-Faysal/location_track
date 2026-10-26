package com.universal.location.demo

import android.content.Context

/** User-controlled tracking preference shared by app and boot recovery. */
object TrackingSettings {
    const val PREFS_NAME = "ule_settings_prefs"
    const val TRACKING_ENABLED_KEY = "tracking_enabled"

    fun isTrackingEnabled(context: Context): Boolean = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getBoolean(TRACKING_ENABLED_KEY, false)

    fun setTrackingEnabled(context: Context, enabled: Boolean) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(TRACKING_ENABLED_KEY, enabled)
            .apply()
    }
}
