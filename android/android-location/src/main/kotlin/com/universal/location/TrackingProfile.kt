package com.universal.location

/** Capture policy presets shared by the SDK and host application. */
enum class TrackingProfile(val intervalSeconds: Long, val minDisplacementMeters: Float) {
    ACTIVE(5, 5f),
    BALANCED(10, 10f),
    STATIONARY(60, 25f),
}
