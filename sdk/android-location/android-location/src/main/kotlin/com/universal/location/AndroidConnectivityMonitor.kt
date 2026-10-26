package com.universal.location

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AndroidConnectivityMonitor(context: Context) : ConnectivityMonitor {

    private val _state = MutableStateFlow(ConnectivityState.OFFLINE)
    override val state: StateFlow<ConnectivityState> = _state.asStateFlow()

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    init {
        checkCurrentNetwork()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            connectivityManager.registerDefaultNetworkCallback(
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        _state.value = ConnectivityState.ONLINE
                    }

                    override fun onLost(network: Network) {
                        checkCurrentNetwork()
                    }

                    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                        checkCurrentNetwork()
                    }
                }
            )
        } else {
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
                        checkCurrentNetwork()
                    }
                }
            )
        }
    }

    fun checkCurrentNetwork(): ConnectivityState {
        var isConnected = false
        try {
            val networks = connectivityManager.allNetworks
            for (network in networks) {
                val capabilities = connectivityManager.getNetworkCapabilities(network)
                if (capabilities != null &&
                    (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ||
                     capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))) {
                    isConnected = true
                    break
                }
            }
        } catch (_: Exception) {}

        if (!isConnected) {
            try {
                @Suppress("DEPRECATION")
                val activeInfo = connectivityManager.activeNetworkInfo
                @Suppress("DEPRECATION")
                if (activeInfo != null && activeInfo.isConnected) {
                    isConnected = true
                }
            } catch (_: Exception) {}
        }

        val currentState = if (isConnected) ConnectivityState.ONLINE else ConnectivityState.OFFLINE
        _state.value = currentState
        return currentState
    }
}
