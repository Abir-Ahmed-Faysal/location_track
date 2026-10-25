package com.universal.location

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters

/** Host application supplies these dependencies from its DI container. */
fun interface SyncWorkerDependencies {
    suspend fun sync(): UploadResult
}

object LocationSyncRuntime {
    @Volatile var dependencies: SyncWorkerDependencies? = null
}

class LocationSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return when (LocationSyncRuntime.dependencies?.sync()) {
            is UploadResult.Acknowledged -> Result.success()
            is UploadResult.RetryableFailure, null -> Result.retry()
            is UploadResult.PermanentFailure -> Result.failure()
        }
    }

    companion object {
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<LocationSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "universal-location-sync",
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
