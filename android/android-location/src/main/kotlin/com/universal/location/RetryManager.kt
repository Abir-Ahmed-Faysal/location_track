package com.universal.location

/** Retry decision helper; scheduling itself remains owned by WorkManager/host app. */
class RetryManager(private val policy: RetryPolicy = RetryPolicy()) {
    fun nextDelayMillis(attempt: Int, result: UploadResult): Long? {
        if (attempt >= policy.maxAttempts) return null
        return when (result) {
            is UploadResult.RetryableFailure ->
                result.retryAfterSeconds?.times(1_000)
                    ?: policy.delayForAttempt(attempt + 1)
            is UploadResult.Acknowledged,
            is UploadResult.PermanentFailure -> null
        }
    }
}
