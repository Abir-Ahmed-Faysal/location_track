package com.universal.location.demo

import android.content.Context
import com.universal.location.TrackingProfile

/** User-controlled tracking preference shared by app and boot recovery. */
object TrackingSettings {
    const val PREFS_NAME = "ule_settings_prefs"
    const val TRACKING_ENABLED_KEY = "tracking_enabled"
    const val TRACKING_PROFILE_KEY = "tracking_profile"

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

    fun getProfile(context: Context): TrackingProfile {
        val value = context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(TRACKING_PROFILE_KEY, TrackingProfile.BALANCED.name)
        return runCatching { TrackingProfile.valueOf(value ?: TrackingProfile.BALANCED.name) }
            .getOrDefault(TrackingProfile.BALANCED)
    }

    fun setProfile(context: Context, profile: TrackingProfile) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(TRACKING_PROFILE_KEY, profile.name)
            .apply()
    }
}
