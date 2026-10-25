package com.universal.location

import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.TimeUnit

data class BatchIngestRequestJson(
    val schemaVersion: Int = 1,
    val events: List<LocationEventJson>,
)

data class LocationEventJson(
    val eventId: String,
    val deviceId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double?,
    val capturedAt: String,
    val sequence: Long? = null,
    val provider: String?,
    val altitudeM: Double?,
    val speedMps: Double?,
    val bearingDeg: Double?,
    val platformVersion: String? = "Android",
    val mockLocationIndicator: Boolean? = false,
)

data class BatchIngestResponseJson(
    val accepted: List<String>?,
    val duplicates: List<String>?,
    val rejected: List<Any>?,
    val serverTime: String?,
)

class HttpBatchUploader(
    private val apiBaseUrl: String,
    private val authToken: String? = null,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson(),
) : BatchUploader {

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun upload(events: List<LocationEvent>): UploadResult {
        if (events.isEmpty()) {
            return UploadResult.Acknowledged(emptySet(), emptySet())
        }

        val jsonPayload = gson.toJson(
            BatchIngestRequestJson(
                schemaVersion = 1,
                events = events.map { it.toJsonDto() },
            )
        )

        val requestUrl = "${apiBaseUrl.trimEnd('/')}/locations/batch"
        val requestBuilder = Request.Builder()
            .url(requestUrl)
            .post(jsonPayload.toRequestBody(jsonMediaType))

        if (!authToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $authToken")
        }

        return try {
            val response = client.newCall(requestBuilder.build()).execute()
            val responseBodyString = response.body?.string()

            if (response.isSuccessful && !responseBodyString.isNullOrBlank()) {
                val parsed = gson.fromJson(responseBodyString, BatchIngestResponseJson::class.java)
                val acceptedUuids = parsed.accepted?.mapNotNull { parseUuidSafely(it) }?.toSet() ?: emptySet()
                val duplicateUuids = parsed.duplicates?.mapNotNull { parseUuidSafely(it) }?.toSet() ?: emptySet()
                UploadResult.Acknowledged(acceptedUuids, duplicateUuids)
            } else if (response.code == 429) {
                val retryAfter = response.header("Retry-After")?.toLongOrNull()
                UploadResult.RetryableFailure(retryAfterSeconds = retryAfter)
            } else if (response.code in 500..599) {
                UploadResult.RetryableFailure()
            } else {
                UploadResult.PermanentFailure("HTTP ${response.code}: ${responseBodyString ?: response.message}")
            }
        } catch (e: IOException) {
            UploadResult.RetryableFailure()
        } catch (e: Exception) {
            UploadResult.PermanentFailure(e.message ?: "Unknown upload exception")
        }
    }

    private fun parseUuidSafely(uuidString: String): UUID? = try {
        UUID.fromString(uuidString)
    } catch (_: Exception) {
        null
    }
}

private fun LocationEvent.toJsonDto(): LocationEventJson = LocationEventJson(
    eventId = eventId.toString(),
    deviceId = deviceId,
    latitude = latitude,
    longitude = longitude,
    accuracyM = accuracyMeters,
    capturedAt = DateTimeFormatter.ISO_INSTANT.format(capturedAt),
    provider = provider,
    altitudeM = altitudeMeters,
    speedMps = speedMps,
    bearingDeg = bearingDegrees,
    mockLocationIndicator = isMock,
)
