package com.universal.location

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AndroidConnectivityMonitor(context: Context) : ConnectivityMonitor {

    private val _state = MutableStateFlow(ConnectivityState.OFFLINE)
    override val state: StateFlow<ConnectivityState> = _state.asStateFlow()

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    init {
        val initialCapabilities = connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork)
        val initialIsOnline = initialCapabilities != null &&
            initialCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        _state.value = if (initialIsOnline) ConnectivityState.ONLINE else ConnectivityState.OFFLINE

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(
            networkRequest,
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    _state.value = ConnectivityState.ONLINE
                }

                override fun onLost(network: Network) {
                    _state.value = ConnectivityState.OFFLINE
                }
            }
        )
    }
}
