package com.universal.location

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.delay

/** Host application supplies these dependencies from its DI container. */
fun interface SyncWorkerDependencies {
    suspend fun sync(): UploadResult
}

/** Rebuilds sync dependencies when WorkManager starts a new application process. */
fun interface SyncWorkerDependenciesFactory {
    fun create(context: Context): SyncWorkerDependencies?
}

object LocationSyncRuntime {
    @Volatile var dependencies: SyncWorkerDependencies? = null
    @Volatile var dependenciesFactory: SyncWorkerDependenciesFactory? = null
}

class LocationSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val dependencies = LocationSyncRuntime.dependencies
            ?: LocationSyncRuntime.dependenciesFactory?.create(applicationContext)
            ?: return Result.retry()

        repeat(MAX_BATCHES_PER_RUN) { batchIndex ->
            when (val result = dependencies.sync()) {
                is UploadResult.Acknowledged -> {
                    if (result.accepted.isEmpty() && result.duplicates.isEmpty()) {
                        if (batchIndex < EMPTY_QUEUE_GRACE_CHECKS) {
                            delay(EMPTY_QUEUE_GRACE_DELAY_MS)
                            return@repeat
                        }
                        return Result.success()
                    }
                }
                is UploadResult.RetryableFailure -> return Result.retry()
                is UploadResult.PermanentFailure -> return Result.failure()
            }
        }
        return Result.retry()
    }

    companion object {
        private const val MAX_BATCHES_PER_RUN = 20
        private const val EMPTY_QUEUE_GRACE_CHECKS = 1
        private const val EMPTY_QUEUE_GRACE_DELAY_MS = 500L

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<LocationSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(
                    androidx.work.BackoffPolicy.EXPONENTIAL,
                    10,
                    TimeUnit.SECONDS,
                )
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "universal-location-sync",
                // One worker drains the durable Room queue. KEEP prevents every
                // GPS callback from creating another chained worker while offline.
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
