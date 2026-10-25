package com.universal.location

import java.time.Instant
import java.util.UUID

/** Canonical event queued before network upload. */
data class LocationEvent(
    val eventId: UUID = UUID.randomUUID(),
    val deviceId: String,
    val capturedAt: Instant,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double? = null,
    val altitudeMeters: Double? = null,
    val speedMps: Double? = null,
    val bearingDegrees: Double? = null,
    val provider: String? = null,
    val isMock: Boolean = false,
)
