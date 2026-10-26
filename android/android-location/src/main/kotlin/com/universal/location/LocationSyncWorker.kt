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

        repeat(MAX_BATCHES_PER_RUN) {
            when (val result = dependencies.sync()) {
                is UploadResult.Acknowledged -> {
                    if (result.accepted.isEmpty() && result.duplicates.isEmpty()) {
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
                // A location can be captured while the current worker is in its
                // final queue check. APPEND_OR_REPLACE preserves that enqueue
                // instead of dropping it like KEEP does for running work.
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request,
            )
        }
    }
}
