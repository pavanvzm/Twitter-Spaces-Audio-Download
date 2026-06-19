package com.xspaces.downloader.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.xspaces.downloader.data.model.DownloadStatus
import com.xspaces.downloader.data.model.DownloadTask
import com.xspaces.downloader.ui.components.DownloadCard
import com.xspaces.downloader.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DownloadsScreen(
    viewModel: DownloadsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Download Library") },
                navigationIcon = {
                    IconButton(onClick = { /* Navigate back */ }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Gray950
                )
            )
        },
        containerColor = Gray950
    ) { padding ->
        if (uiState.downloads.isEmpty()) {
            // Empty state
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Download,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = Gray700
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No downloads yet",
                        style = MaterialTheme.typography.titleMedium,
                        color = Gray400
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Your downloaded Space recordings will appear here",
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray500
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Active downloads section
                val activeDownloads = uiState.downloads.filter {
                    it.status in listOf(
                        DownloadStatus.PENDING,
                        DownloadStatus.DOWNLOADING,
                        DownloadStatus.PROCESSING
                    )
                }

                if (activeDownloads.isNotEmpty()) {
                    item {
                        Text(
                            text = "In Progress",
                            style = MaterialTheme.typography.titleSmall,
                            color = Gray400
                        )
                    }

                    items(activeDownloads) { download ->
                        DownloadCard(
                            download = download,
                            onSaveClick = null,
                            onDeleteClick = { viewModel.deleteDownload(download.id) }
                        )
                    }

                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }

                // Completed downloads section
                val completedDownloads = uiState.downloads.filter {
                    it.status in listOf(DownloadStatus.COMPLETED, DownloadStatus.FAILED)
                }

                if (completedDownloads.isNotEmpty()) {
                    item {
                        Text(
                            text = "Completed (${completedDownloads.size})",
                            style = MaterialTheme.typography.titleSmall,
                            color = Gray400
                        )
                    }

                    items(completedDownloads) { download ->
                        DownloadCard(
                            download = download,
                            onSaveClick = { viewModel.saveFile(download.id) },
                            onDeleteClick = { viewModel.deleteDownload(download.id) }
                        )
                    }
                }
            }
        }
    }
}
