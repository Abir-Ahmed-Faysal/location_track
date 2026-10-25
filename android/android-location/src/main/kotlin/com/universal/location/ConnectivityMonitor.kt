package com.universal.location

import kotlinx.coroutines.flow.StateFlow

enum class ConnectivityState { ONLINE, OFFLINE }

/** Host-provided or SDK connectivity adapter. */
interface ConnectivityMonitor {
    val state: StateFlow<ConnectivityState>
}
