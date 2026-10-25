package com.universal.location

/** Coordinates durable queue reads and upload acknowledgements without dropping events. */
class SyncCoordinator(
    private val queue: EventQueue,
    private val uploader: BatchUploader,
    private val batchSize: Int = 5,
) {
    suspend fun syncOnce(): UploadResult {
        val events = queue.peek(batchSize)
        if (events.isEmpty()) {
            return UploadResult.Acknowledged(emptySet(), emptySet())
        }

        return when (val result = uploader.upload(events)) {
            is UploadResult.Acknowledged -> {
                queue.acknowledge(result.accepted + result.duplicates)
                result
            }
            is UploadResult.RetryableFailure -> result
            is UploadResult.PermanentFailure -> result
        }
    }
}
