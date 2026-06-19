package com.xspaces.downloader.data.model

data class DownloadTask(
    val id: String,
    val spaceId: String,
    val metadata: Space?,
    val status: DownloadStatus,
    val progress: Int,
    val format: String,
    val fileSize: Long?,
    val createdAt: Long,
    val completedAt: Long?,
    val error: String?
)

enum class DownloadStatus {
    PENDING,
    DOWNLOADING,
    PROCESSING,
    COMPLETED,
    FAILED;

    companion object {
        fun fromString(status: String?): DownloadStatus {
            return when (status?.lowercase()) {
                "pending" -> PENDING
                "downloading" -> DOWNLOADING
                "processing" -> PROCESSING
                "completed" -> COMPLETED
                "failed" -> FAILED
                else -> PENDING
            }
        }
    }
}

data class DownloadStartResult(
    val success: Boolean,
    val taskId: String?,
    val metadata: Space?,
    val status: String?,
    val error: String? = null
)
