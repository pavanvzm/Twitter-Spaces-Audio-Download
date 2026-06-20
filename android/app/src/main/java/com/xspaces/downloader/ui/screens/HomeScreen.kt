@file:OptIn(ExperimentalMaterial3Api::class)

package com.xspaces.downloader.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.xspaces.downloader.data.model.Space
import com.xspaces.downloader.data.model.SpaceStatus
import com.xspaces.downloader.data.model.User
import com.xspaces.downloader.ui.components.DownloadCard
import com.xspaces.downloader.ui.theme.*

@Composable
fun HomeScreen(
    onLogout: () -> Unit,
    user: User?,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "X",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Spaces Downloader",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                },
                actions = {
                    if (user != null) {
                        IconButton(onClick = { /* Navigate to downloads */ }) {
                            Icon(Icons.Default.Download, contentDescription = "Downloads")
                        }
                        IconButton(onClick = onLogout) {
                            Icon(Icons.Default.Logout, contentDescription = "Logout")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Gray950
                )
            )
        },
        containerColor = Gray950
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // User info card
            if (user != null) {
                UserInfoCard(user = user)
                Spacer(modifier = Modifier.height(24.dp))
            }

            // URL Input Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Gray900),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Download Space",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = uiState.spaceUrl,
                        onValueChange = { viewModel.updateSpaceUrl(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Paste X Space URL here") },
                        leadingIcon = {
                            Icon(Icons.Default.Link, contentDescription = null)
                        },
                        trailingIcon = {
                            if (uiState.isValidating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp
                                )
                            }
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Uri,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { focusManager.clearFocus() }
                        ),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = XWhite,
                            unfocusedBorderColor = Gray700
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    // Error message
                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = uiState.error!!,
                            color = Red500,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Format selector
                    Text(
                        text = "Output Format",
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray400
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        FormatChip(
                            format = "MP3",
                            selected = uiState.format == "mp3",
                            onClick = { viewModel.updateFormat("mp3") }
                        )
                        FormatChip(
                            format = "WAV",
                            selected = uiState.format == "wav",
                            onClick = { viewModel.updateFormat("wav") }
                        )
                        FormatChip(
                            format = "M4A",
                            selected = uiState.format == "m4a",
                            onClick = { viewModel.updateFormat("m4a") }
                        )
                    }

                    // Space info
                    if (uiState.spaceInfo != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        SpaceInfoCard(space = uiState.spaceInfo!!)

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = { viewModel.startDownload() },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = uiState.spaceInfo!!.status != SpaceStatus.LIVE && !uiState.isDownloading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = XBlack,
                                contentColor = XWhite
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (uiState.isDownloading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = XWhite,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Downloading...")
                            } else if (uiState.spaceInfo!!.status == SpaceStatus.LIVE) {
                                Icon(Icons.Default.Warning, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Cannot download live Spaces")
                            } else {
                                Icon(Icons.Default.Download, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Download ${uiState.format.uppercase()}")
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Active downloads
            if (uiState.activeDownload != null) {
                Text(
                    text = "Current Download",
                    style = MaterialTheme.typography.titleSmall,
                    color = Gray400
                )
                Spacer(modifier = Modifier.height(12.dp))
                DownloadCard(
                    download = uiState.activeDownload!!,
                    onSaveClick = { viewModel.saveFile(uiState.activeDownload!!.id) },
                    onDeleteClick = null
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Help section
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Gray900),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = null,
                        tint = Gray500
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "How to get a Space URL",
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray400
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Open a Space on X → Tap share → Copy link → Paste above",
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray500
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun UserInfoCard(user: User) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Gray900),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (user.avatarUrl.isNotEmpty()) {
                AsyncImage(
                    model = user.avatarUrl,
                    contentDescription = "Avatar",
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Gray700),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = Gray400)
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "@${user.username}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Gray400
                )
            }
        }
    }
}

@Composable
private fun FormatChip(
    format: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(format) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = XWhite,
            selectedLabelColor = XBlack,
            containerColor = Gray800,
            labelColor = Gray400
        )
    )
}

@Composable
private fun SpaceInfoCard(space: Space) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Gray800),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (space.host.avatarUrl.isNotEmpty()) {
                AsyncImage(
                    model = space.host.avatarUrl,
                    contentDescription = "Host avatar",
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = space.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "by @${space.host.username}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Gray400
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusBadge(status = space.status)
                    if (space.duration != null) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = formatDuration(space.duration),
                            style = MaterialTheme.typography.bodySmall,
                            color = Gray500
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: SpaceStatus) {
    val (color, text) = when (status) {
        SpaceStatus.LIVE -> Red500 to "LIVE"
        SpaceStatus.ENDED -> Green500 to "Ended"
        SpaceStatus.SCHEDULED -> Gray400 to "Scheduled"
        SpaceStatus.UNKNOWN -> Gray500 to "Unknown"
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.SemiBold
        )
    }
}

private fun formatDuration(seconds: Long): String {
    val mins = seconds / 60
    val secs = seconds % 60
    return "${mins}:${secs.toString().padStart(2, '0')}"
}
