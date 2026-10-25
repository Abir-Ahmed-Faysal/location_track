package com.universal.location

import kotlinx.coroutines.flow.Flow

/** Host-provided location provider adapter, typically backed by Fused Location Provider. */
interface LocationCapturer {
    fun locations(profile: TrackingProfile): Flow<LocationEvent>
    suspend fun requestFreshLocation(): LocationEvent?
}
