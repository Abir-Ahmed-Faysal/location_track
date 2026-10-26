package com.universal.location.demo

import com.google.gson.Gson
import com.universal.location.LocationHeartbeatSender
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class HeartbeatClient(
    context: android.content.Context,
    private val apiBaseUrl: String,
    private val deviceId: String,
) : LocationHeartbeatSender {
    private val session = AuthSession(context, apiBaseUrl)
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun send(): Boolean {
        val token = session.accessToken() ?: return false
        val body = Gson().toJson(mapOf("externalDeviceKey" to deviceId))
        fun request(accessToken: String) = Request.Builder()
            .url("${apiBaseUrl.trimEnd('/')}/devices/heartbeat")
            .post(body.toRequestBody("application/json".toMediaType()))
            .header("Authorization", "Bearer $accessToken")
            .header("bypass-tunnel-reminder", "true")
            .build()

        val response = client.newCall(request(token)).execute()
        if (response.code == 401) {
            response.close()
            val refreshed = session.refreshAccessToken() ?: return false
            return client.newCall(request(refreshed)).execute().use { it.isSuccessful }
        }
        return response.use { it.isSuccessful }
    }
}
