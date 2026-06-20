package com.xspaces.downloader.data.repository

import android.content.Context
import android.os.Environment
import com.xspaces.downloader.data.model.DownloadStartResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DownloadRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val BASE_URL = "http://10.0.2.2:3001/api" // localhost for emulator
    }

    private val downloadsDir: File
        get() {
            val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "XSpaces")
            if (!dir.exists()) dir.mkdirs()
            return dir
        }

    suspend fun startDownload(spaceId: String, format: String): DownloadStartResult = 
        withContext(Dispatchers.IO) {
            // In production, call backend to start download
            // For now, return mock result
            DownloadStartResult(
                success = true,
                taskId = "task_${System.currentTimeMillis()}",
                metadata = null,
                status = "pending"
            )
        }

    suspend fun getDownloadStatus(taskId: String): DownloadStatusResponse = 
        withContext(Dispatchers.IO) {
            // In production, poll backend for status
            // For now, return completed status
            DownloadStatusResponse(
                status = "completed",
                progress = 100,
                fileSize = 15_000_000L, // 15MB mock
                error = null
            )
        }

    suspend fun downloadFile(taskId: String): File? = withContext(Dispatchers.IO) {
        // In production, download from backend
        // For now, return null
        null
    }

    suspend fun deleteDownload(taskId: String): Boolean = withContext(Dispatchers.IO) {
        val file = File(downloadsDir, "$taskId.mp3")
        if (file.exists()) file.delete()
        true
    }

    suspend fun getDownloadHistory(): List<com.xspaces.downloader.data.model.DownloadTask> = withContext(Dispatchers.IO) {
        // In production, get from database or backend
        emptyList()
    }

    fun getDownloadsDirectory(): File = downloadsDir
}

data class DownloadStatusResponse(
    val status: String,
    val progress: Int,
    val fileSize: Long?,
    val error: String?
)

data class DownloadHistoryItem(
    val taskId: String,
    val spaceId: String,
    val title: String,
    val format: String,
    val fileSize: Long,
    val downloadedAt: Long
)
