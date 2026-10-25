package com.universal.location.demo

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.universal.location.ConnectivityState
import com.universal.location.TrackingProfile
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.initEngine(this)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    LocationDemoScreen(viewModel)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationDemoScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val apiBaseUrl by viewModel.apiBaseUrl.collectAsState()
    val deviceId by viewModel.deviceId.collectAsState()
    val authToken by viewModel.authToken.collectAsState()
    val trackingProfile by viewModel.trackingProfile.collectAsState()
    val lastEvent by viewModel.lastCapturedEvent.collectAsState()
    val diagnostics by viewModel.diagnostics.collectAsState()
    val isServiceRunning by viewModel.isTrackingServiceRunning.collectAsState()
    val connectivity by viewModel.connectivityState.collectAsState()

    var permissionsGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        permissionsGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Universal Location Engine", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Permission Banner
            if (!permissionsGranted) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Location permissions required", fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = {
                            val perms = mutableListOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                perms.add(Manifest.permission.POST_NOTIFICATIONS)
                            }
                            permissionLauncher.launch(perms.toTypedArray())
                        }) {
                            Text("Grant Location Permissions")
                        }
                    }
                }
            }

            // Engine Configuration Card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Configuration", fontWeight = FontWeight.Bold, fontSize = 18.sp)

                    OutlinedTextField(
                        value = apiBaseUrl,
                        onValueChange = { viewModel.apiBaseUrl.value = it },
                        label = { Text("API Base URL") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = deviceId,
                        onValueChange = { viewModel.deviceId.value = it },
                        label = { Text("Device ID") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = authToken,
                        onValueChange = { viewModel.authToken.value = it },
                        label = { Text("Auth Bearer Token (Optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("Tracking Profile", fontWeight = FontWeight.Medium)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        TrackingProfile.entries.forEach { profile ->
                            FilterChip(
                                selected = trackingProfile == profile,
                                onClick = { viewModel.trackingProfile.value = profile },
                                label = { Text(profile.name) }
                            )
                        }
                    }
                }
            }

            // Tracking Control Switch
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Location Service", fontWeight = FontWeight.Bold)
                        Text(
                            if (isServiceRunning) "Tracking Active" else "Stopped",
                            color = if (isServiceRunning) Color(0xFF2E7D32) else Color.Gray
                        )
                    }
                    Switch(
                        checked = isServiceRunning,
                        onCheckedChange = { start ->
                            if (start) {
                                viewModel.startTracking(context)
                            } else {
                                viewModel.stopTracking(context)
                            }
                        }
                    )
                }
            }

            // Live Location Card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Live Location", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        val freshness = viewModel.calculateFreshness(lastEvent?.capturedAt)
                        FreshnessBadgeChip(freshness)
                    }

                    if (lastEvent != null) {
                        Text("Latitude: ${lastEvent?.latitude}")
                        Text("Longitude: ${lastEvent?.longitude}")
                        Text("Accuracy: ${lastEvent?.accuracyMeters?.let { "%.1fm".format(it) } ?: "N/A"}")
                        Text("Altitude: ${lastEvent?.altitudeMeters?.let { "%.1fm".format(it) } ?: "N/A"}")
                        Text("Speed: ${lastEvent?.speedMps?.let { "%.1fm/s".format(it) } ?: "N/A"}")
                        Text("Provider: ${lastEvent?.provider ?: "N/A"}")
                        val formattedTime = lastEvent?.capturedAt
                            ?.atZone(ZoneId.systemDefault())
                            ?.format(DateTimeFormatter.ofPattern("HH:mm:ss"))
                        Text("Captured At: ${formattedTime ?: "N/A"}")
                    } else {
                        Text("No location captured yet.", color = Color.Gray)
                    }
                }
            }

            // Diagnostics Dashboard
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Engine Diagnostics", fontWeight = FontWeight.Bold, fontSize = 18.sp)

                    Text("Network State: ${if (connectivity == ConnectivityState.ONLINE) "ONLINE" else "OFFLINE"}")
                    Text("Queued Events: ${diagnostics.queuedEvents}")
                    Text("Uploaded Events: ${diagnostics.uploadedEvents}")
                    Text("Failed Uploads: ${diagnostics.failedUploads}")

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { viewModel.triggerManualSync(context) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Sync Now")
                        }
                        OutlinedButton(
                            onClick = { viewModel.requestFreshLocation() },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Get Fresh Fix")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun FreshnessBadgeChip(badge: FreshnessBadge) {
    val (color, text) = when (badge) {
        FreshnessBadge.FRESH -> Color(0xFF2E7D32) to "FRESH"
        FreshnessBadge.DELAYED -> Color(0xFFF57F17) to "DELAYED"
        FreshnessBadge.STALE -> Color(0xFFC62828) to "STALE"
    }

    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), shape = RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(text, color = color, fontWeight = FontWeight.Bold, fontSize = 12.sp)
    }
}
