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

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _state = MutableStateFlow(
        if (isNetworkConnected()) ConnectivityState.ONLINE else ConnectivityState.OFFLINE
    )
    override val state: StateFlow<ConnectivityState> = _state.asStateFlow()

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
        val currentState = if (isNetworkConnected()) ConnectivityState.ONLINE else ConnectivityState.OFFLINE
        _state.value = currentState
        return currentState
    }

    private fun isNetworkConnected(): Boolean {
        return try {
            val activeNet = connectivityManager.activeNetwork
            if (activeNet != null) {
                val caps = connectivityManager.getNetworkCapabilities(activeNet)
                if (caps != null && (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))) {
                    return true
                }
            }
            @Suppress("DEPRECATION")
            val activeInfo = connectivityManager.activeNetworkInfo
            if (activeInfo != null && activeInfo.isConnected) {
                return true
            }
            // Check all networks array
            val networks = connectivityManager.allNetworks
            for (net in networks) {
                val caps = connectivityManager.getNetworkCapabilities(net)
                if (caps != null && (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))) {
                    return true
                }
            }
            false
        } catch (_: Exception) {
            true
        }
    }
}
