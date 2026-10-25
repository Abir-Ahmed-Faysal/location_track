package com.universal.location

enum class LocationPermission { FINE, COARSE, BACKGROUND }

/** Host-provided Android permission adapter. */
interface PermissionManager {
    fun hasPermission(permission: LocationPermission): Boolean
    suspend fun request(permission: LocationPermission): Boolean
}
