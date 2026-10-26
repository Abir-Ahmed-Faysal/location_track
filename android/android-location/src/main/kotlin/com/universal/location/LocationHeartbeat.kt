package com.universal.location

import android.content.Context

fun interface LocationHeartbeatSender {
    suspend fun send(): Boolean
}

fun interface LocationHeartbeatSenderFactory {
    fun create(context: Context): LocationHeartbeatSender?
}

object LocationHeartbeatRuntime {
    @Volatile var senderFactory: LocationHeartbeatSenderFactory? = null
}
