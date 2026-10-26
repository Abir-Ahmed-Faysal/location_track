package com.universal.location.demo

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Stores access and refresh tokens encrypted by Android Keystore AES keys. */
class SecureTokenStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun read(): String? {
        val encrypted = preferences.getString(ENCRYPTED_TOKEN_KEY, null)
        if (encrypted == null) {
            return preferences.getString(LEGACY_TOKEN_KEY, null)
                ?.takeIf { it.isNotBlank() }
                ?.also { write(it) }
        }
        return runCatching {
            val decoded = Base64.decode(encrypted, Base64.DEFAULT)
            val ivLength = decoded.copyOfRange(0, 4).toInt()
            val iv = decoded.copyOfRange(4, 4 + ivLength)
            val ciphertext = decoded.copyOfRange(4 + ivLength, decoded.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            cipher.doFinal(ciphertext).toString(StandardCharsets.UTF_8)
        }.getOrNull()
    }

    fun readRefreshToken(): String? = readValue(REFRESH_TOKEN_KEY)

    fun write(token: String) {
        writeValue(ENCRYPTED_TOKEN_KEY, token)
    }

    fun write(accessToken: String, refreshToken: String) {
        writeValue(ENCRYPTED_TOKEN_KEY, accessToken)
        writeValue(REFRESH_TOKEN_KEY, refreshToken)
    }

    private fun writeValue(storageKey: String, token: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
        val payload = ByteArray(4 + iv.size + ciphertext.size)
        val length = iv.size
        payload[0] = (length ushr 24).toByte()
        payload[1] = (length ushr 16).toByte()
        payload[2] = (length ushr 8).toByte()
        payload[3] = length.toByte()
        iv.copyInto(payload, 4)
        ciphertext.copyInto(payload, 4 + iv.size)
        preferences.edit()
            .putString(storageKey, Base64.encodeToString(payload, Base64.NO_WRAP))
            .remove(LEGACY_TOKEN_KEY)
            .apply()
    }

    fun clear() {
        preferences.edit().remove(ENCRYPTED_TOKEN_KEY).remove(REFRESH_TOKEN_KEY).remove(LEGACY_TOKEN_KEY).apply()
    }

    private fun readValue(storageKey: String): String? {
        val encrypted = preferences.getString(storageKey, null) ?: return null
        return runCatching {
            val decoded = Base64.decode(encrypted, Base64.DEFAULT)
            val ivLength = decoded.copyOfRange(0, 4).toInt()
            val iv = decoded.copyOfRange(4, 4 + ivLength)
            val ciphertext = decoded.copyOfRange(4 + ivLength, decoded.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            cipher.doFinal(ciphertext).toString(StandardCharsets.UTF_8)
        }.getOrNull()
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KEY_ALGORITHM, ANDROID_KEYSTORE).apply {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setKeySize(256)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
        }.generateKey()
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALGORITHM = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val KEY_ALIAS = "ule_demo_access_token"
        private const val PREFERENCES = "ule_settings_prefs"
        private const val ENCRYPTED_TOKEN_KEY = "auth_token_encrypted"
        private const val REFRESH_TOKEN_KEY = "refresh_token_encrypted"
        private const val LEGACY_TOKEN_KEY = "auth_token"
    }
}

private fun ByteArray.toInt(): Int =
    ((this[0].toInt() and 0xff) shl 24) or
        ((this[1].toInt() and 0xff) shl 16) or
        ((this[2].toInt() and 0xff) shl 8) or
        (this[3].toInt() and 0xff)
