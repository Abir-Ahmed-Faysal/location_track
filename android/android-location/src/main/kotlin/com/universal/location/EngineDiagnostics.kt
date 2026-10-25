package com.universal.location

import java.time.Instant

data class EngineDiagnostics(
    val queuedEvents: Int,
    val oldestEventAt: Instant?,
    val uploadedEvents: Long,
    val failedUploads: Long,
)
