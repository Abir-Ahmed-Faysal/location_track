package com.universal.location.demo

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
    val adminSettingsUnlocked by viewModel.adminSettingsUnlocked.collectAsState()
    val adminLoginMessage by viewModel.adminLoginMessage.collectAsState()
    var emailInput by remember { mutableStateOf("") }
    var passwordInput by remember { mutableStateOf("") }
    var nameInput by remember { mutableStateOf("") }
    var registrationMode by remember { mutableStateOf(false) }

    var permissionsGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    val locationManager = remember { context.getSystemService(Context.LOCATION_SERVICE) as LocationManager }
    var isGpsEnabled by remember {
        mutableStateOf(
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        )
    }

    val backgroundPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        permissionsGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (permissionsGranted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    if (authToken.isBlank()) {
        LoginOnlyScreen(
            apiBaseUrl = apiBaseUrl,
            onApiBaseUrlChange = { viewModel.apiBaseUrl.value = it },
            showDeveloperSettings = BuildConfig.DEBUG,
            email = emailInput,
            onEmailChange = { emailInput = it },
            password = passwordInput,
            onPasswordChange = { passwordInput = it },
            name = nameInput,
            onNameChange = { nameInput = it },
            registrationMode = registrationMode,
            onRegistrationModeChange = { registrationMode = it },
            onSignIn = { viewModel.loginUser(context, emailInput, passwordInput) },
            onRegister = { viewModel.registerUser(context, nameInput, emailInput, passwordInput) },
        )
        return
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

            // System GPS Disabled Alert Banner
            if (!isGpsEnabled) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("🚨 System GPS / Location is Turned OFF", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Turn ON Location in phone settings to capture GPS coordinates.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onErrorContainer)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = {
                            context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                        }) {
                            Text("Turn ON Location Settings")
                        }
                    }
                }
            }

            // Protected administrator settings
            var showAdminLogin by remember { mutableStateOf(false) }
            var adminEmail by remember { mutableStateOf("") }
            var adminPassword by remember { mutableStateOf("") }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Administrator Settings", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    if (!adminSettingsUnlocked) {
                        Text("API, device identity, and tracking policies are protected.", color = Color.Gray)
                        TextButton(onClick = { showAdminLogin = !showAdminLogin }) {
                            Text(if (showAdminLogin) "Hide administrator login" else "Unlock configuration")
                        }
                        if (showAdminLogin) {
                            OutlinedTextField(adminEmail, { adminEmail = it }, label = { Text("Administrator email") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(adminPassword, { adminPassword = it }, label = { Text("Administrator password") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
                            adminLoginMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                            Button(onClick = { viewModel.loginAdmin(context, adminEmail, adminPassword) }, modifier = Modifier.fillMaxWidth()) {
                                Text("Unlock Settings")
                            }
                        }
                    } else {
                        Text("Configuration unlocked for administrator", color = Color(0xFF2E7D32))

                        if (BuildConfig.DEBUG) {
                            OutlinedTextField(
                                value = apiBaseUrl,
                                onValueChange = { viewModel.apiBaseUrl.value = it },
                                label = { Text("API Base URL (development)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        OutlinedTextField(
                            value = deviceId,
                            onValueChange = { viewModel.deviceId.value = it },
                            label = { Text("Device ID") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = authToken,
                            onValueChange = { viewModel.authToken.value = it },
                            label = { Text("Auth Bearer Token") },
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Tracking Profile", fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TrackingProfile.values().forEach { profile ->
                                FilterChip(
                                    selected = trackingProfile == profile,
                                    onClick = { viewModel.trackingProfile.value = profile },
                                    label = { Text(profile.name) }
                                )
                            }
                        }

                        Button(onClick = { viewModel.saveAndApplyConfiguration(context) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Save & Apply Settings")
                        }
                    }
                }
            }

            // Foreground Service Controller
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
                            text = if (isServiceRunning) "Tracking Active" else "Stopped",
                            color = if (isServiceRunning) Color(0xFF2E7D32) else Color.Gray
                        )
                    }
                    Switch(
                        checked = isServiceRunning,
                        onCheckedChange = { running ->
                            if (running) viewModel.startTracking(context)
                            else viewModel.stopTracking(context)
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
                    Text("GPS Hardware: ${if (isGpsEnabled) "ENABLED" else "DISABLED"}")
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
                            onClick = { viewModel.requestFreshLocation(context) },
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
private fun LoginOnlyScreen(
    apiBaseUrl: String,
    onApiBaseUrlChange: (String) -> Unit,
    showDeveloperSettings: Boolean,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    name: String,
    onNameChange: (String) -> Unit,
    registrationMode: Boolean,
    onRegistrationModeChange: (Boolean) -> Unit,
    onSignIn: () -> Unit,
    onRegister: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(modifier = Modifier.height(36.dp))
        Text("Universal Location Engine", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(if (registrationMode) "Create your account and request device access." else "Sign in to enroll this device and start tracking.")
        if (showDeveloperSettings) {
            OutlinedTextField(apiBaseUrl, onApiBaseUrlChange, label = { Text("API Base URL (development)") }, modifier = Modifier.fillMaxWidth())
        }
        if (registrationMode) {
            OutlinedTextField(name, onNameChange, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(email, onEmailChange, label = { Text("Email") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, onPasswordChange, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        Button(onClick = if (registrationMode) onRegister else onSignIn, modifier = Modifier.fillMaxWidth()) {
            Text(if (registrationMode) "Create Account" else "Sign In")
        }
        TextButton(onClick = { onRegistrationModeChange(!registrationMode) }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(if (registrationMode) "Already have an account? Sign in" else "New user? Create an account")
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
    Surface(
        color = color.copy(alpha = 0.15f),
        contentColor = color,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp
        )
    }
}
