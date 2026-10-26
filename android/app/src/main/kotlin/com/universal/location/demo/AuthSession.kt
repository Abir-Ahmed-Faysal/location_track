package com.universal.location.demo

import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Refreshes the short-lived access token used by background location uploads. */
class AuthSession(
    context: android.content.Context,
    private val apiBaseUrl: String,
) {
    private val appContext = context.applicationContext
    private val tokenStore = SecureTokenStore(appContext)
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    fun accessToken(): String? = tokenStore.read()

    @Synchronized
    @Throws(IOException::class)
    fun refreshAccessToken(): String? {
        val refreshToken = tokenStore.readRefreshToken()?.takeIf { it.isNotBlank() } ?: return null
        val body = Gson().toJson(mapOf("refreshToken" to refreshToken))
        val request = Request.Builder()
            .url("${apiBaseUrl.trimEnd('/')}/auth/refresh")
            .post(body.toRequestBody("application/json".toMediaType()))
            .header("bypass-tunnel-reminder", "true")
            .build()

        return client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                if (response.code >= 500) throw IOException("Token refresh failed with HTTP ${response.code}")
                tokenStore.clear()
                return null
            }
            val tokens = runCatching {
                Gson().fromJson(responseBody, RefreshResponse::class.java)
            }.getOrNull()
            if (tokens?.accessToken.isNullOrBlank() || tokens.refreshToken.isNullOrBlank()) {
                tokenStore.clear()
                return null
            }
            tokenStore.write(tokens.accessToken!!, tokens.refreshToken!!)
            tokens.accessToken
        }
    }

    private data class RefreshResponse(
        val accessToken: String?,
        val refreshToken: String?,
    )
}
