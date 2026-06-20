package com.xspaces.downloader.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.xspaces.downloader.data.model.DownloadStatus
import com.xspaces.downloader.data.model.DownloadTask
import com.xspaces.downloader.ui.theme.*

@Composable
fun DownloadCard(
    download: DownloadTask,
    onSaveClick: (() -> Unit)?,
    onDeleteClick: (() -> Unit)?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Gray900),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Thumbnail
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (download.metadata?.host?.avatarUrl?.isNotEmpty() == true) {
                        AsyncImage(
                            model = download.metadata.host.avatarUrl,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Surface(
                            modifier = Modifier.fillMaxSize(),
                            color = Gray800
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = Gray400
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = download.metadata?.title ?: "X Space",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = download.format.uppercase(),
                            style = MaterialTheme.typography.bodySmall,
                            color = Gray500
                        )
                        if (download.fileSize != null) {
                            Text(
                                text = " • ${formatFileSize(download.fileSize)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Gray500
                            )
                        }
                    }
                }

                // Actions
                Row {
                    if (onSaveClick != null && download.status == DownloadStatus.COMPLETED) {
                        IconButton(onClick = onSaveClick) {
                            Icon(
                                Icons.Default.Download,
                                contentDescription = "Save",
                                tint = XWhite
                            )
                        }
                    }
                    if (onDeleteClick != null) {
                        IconButton(onClick = onDeleteClick) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Delete",
                                tint = Gray400
                            )
                        }
                    }
                }
            }

            // Progress section
            if (download.status in listOf(
                    DownloadStatus.PENDING,
                    DownloadStatus.DOWNLOADING,
                    DownloadStatus.PROCESSING
                )
            ) {
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = when (download.status) {
                            DownloadStatus.PENDING -> "Starting..."
                            DownloadStatus.DOWNLOADING -> "Downloading..."
                            DownloadStatus.PROCESSING -> "Processing..."
                            else -> ""
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray400
                    )
                    Text(
                        text = "${download.progress}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = Gray500
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                LinearProgressIndicator(
                    progress = download.progress / 100f,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = XWhite,
                    trackColor = Gray800,
                )
            }

            // Error section
            if (download.status == DownloadStatus.FAILED && download.error != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = Red900.copy(alpha = 0.3f)
                ) {
                    Row(
                        modifier = Modifier.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = Red500,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = download.error,
                            style = MaterialTheme.typography.bodySmall,
                            color = Red500
                        )
                    }
                }
            }

            // Success badge
            if (download.status == DownloadStatus.COMPLETED) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Green500,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Ready to save",
                        style = MaterialTheme.typography.bodySmall,
                        color = Green500
                    )
                }
            }
        }
    }
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
        else -> "${bytes / (1024 * 1024 * 1024)} GB"
    }
}
