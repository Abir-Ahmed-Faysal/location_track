package com.universal.location

import java.util.UUID

sealed interface UploadResult {
    data class Acknowledged(val accepted: Set<UUID>, val duplicates: Set<UUID>) : UploadResult
    data class RetryableFailure(val retryAfterSeconds: Long? = null) : UploadResult
    data class PermanentFailure(val message: String) : UploadResult
}

/** Transport-neutral uploader; implementations can use Retrofit, Ktor, or another client. */
fun interface BatchUploader {
    suspend fun upload(events: List<LocationEvent>): UploadResult
}

data class RetryPolicy(
    val initialDelayMillis: Long = 1_000,
    val maxDelayMillis: Long = 60_000,
    val maxAttempts: Int = 8,
) {
    fun delayForAttempt(attempt: Int): Long {
        require(attempt >= 1) { "attempt must be positive" }
        val exponential = initialDelayMillis * (1L shl (attempt - 1).coerceAtMost(20))
        return exponential.coerceAtMost(maxDelayMillis)
    }
}
