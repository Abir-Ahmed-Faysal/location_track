package com.universal.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import java.util.UUID
import kotlin.coroutines.resume

/**
 * Fused location provider adapter supporting GMS FusedLocationProviderClient with
 * fallback to Android system LocationManager for non-GMS devices.
 */
class FusedLocationCapturer(
    private val context: Context,
    private val deviceId: String,
) : LocationCapturer {

    private val fusedClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(context)
    }

    private val locationManager: LocationManager by lazy {
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }

    override fun locations(profile: TrackingProfile): Flow<LocationEvent> = callbackFlow {
        if (isGooglePlayServicesAvailable()) {
            val locationRequest = LocationRequest.Builder(
                priorityForProfile(profile),
                profile.intervalSeconds * 1000L,
            ).setMinUpdateDistanceMeters(profile.minDisplacementMeters)
                .build()

            val callback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    for (location in result.locations) {
                        trySend(location.toLocationEvent(deviceId))
                    }
                }
            }

            @SuppressLint("MissingPermission")
            fusedClient.requestLocationUpdates(locationRequest, callback, Looper.getMainLooper())

            awaitClose {
                fusedClient.removeLocationUpdates(callback)
            }
        } else {
            val listener = LocationListener { location ->
                trySend(location.toLocationEvent(deviceId))
            }

            @SuppressLint("MissingPermission")
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    profile.intervalSeconds * 1000L,
                    profile.minDisplacementMeters,
                    listener,
                    Looper.getMainLooper(),
                )
            } else if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    profile.intervalSeconds * 1000L,
                    profile.minDisplacementMeters,
                    listener,
                    Looper.getMainLooper(),
                )
            }

            awaitClose {
                locationManager.removeUpdates(listener)
            }
        }
    }

    @SuppressLint("MissingPermission")
    override suspend fun requestFreshLocation(): LocationEvent? {
        if (isGooglePlayServicesAvailable()) {
            return suspendCancellableCoroutine { continuation ->
                fusedClient.lastLocation
                    .addOnSuccessListener { location: Location? ->
                        continuation.resume(location?.toLocationEvent(deviceId))
                    }
                    .addOnFailureListener {
                        continuation.resume(null)
                    }
            }
        } else {
            val provider = when {
                locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                else -> null
            } ?: return null

            val lastLoc = locationManager.getLastKnownLocation(provider)
            return lastLoc?.toLocationEvent(deviceId)
        }
    }

    private fun isGooglePlayServicesAvailable(): Boolean {
        val availability = GoogleApiAvailability.getInstance()
        val result = availability.isGooglePlayServicesAvailable(context)
        return result == ConnectionResult.SUCCESS
    }

    private fun priorityForProfile(profile: TrackingProfile): Int = when (profile) {
        TrackingProfile.ACTIVE -> Priority.PRIORITY_HIGH_ACCURACY
        TrackingProfile.BALANCED -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
        TrackingProfile.STATIONARY -> Priority.PRIORITY_LOW_POWER
    }
}

fun Location.toLocationEvent(deviceId: String): LocationEvent {
    val isMockLocation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        isMock
    } else {
        @Suppress("DEPRECATION")
        isFromMockProvider
    }

    return LocationEvent(
        eventId = UUID.randomUUID(),
        deviceId = deviceId,
        capturedAt = Instant.ofEpochMilli(time),
        latitude = latitude,
        longitude = longitude,
        accuracyMeters = if (hasAccuracy()) accuracy.toDouble() else null,
        altitudeMeters = if (hasAltitude()) altitude else null,
        speedMps = if (hasSpeed()) speed.toDouble() else null,
        bearingDegrees = if (hasBearing()) bearing.toDouble() else null,
        provider = provider,
        isMock = isMockLocation,
    )
}
