package com.xspaces.downloader.ui.screens

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xspaces.downloader.data.model.DownloadTask
import com.xspaces.downloader.data.repository.DownloadRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class DownloadsUiState(
    val downloads: List<DownloadTask> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class DownloadsViewModel @Inject constructor(
    private val downloadRepository: DownloadRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(DownloadsUiState())
    val uiState: StateFlow<DownloadsUiState> = _uiState.asStateFlow()

    init {
        loadDownloads()
    }

    private fun loadDownloads() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val downloads = downloadRepository.getDownloadHistory()
                _uiState.value = _uiState.value.copy(
                    downloads = downloads,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            }
        }
    }

    fun deleteDownload(taskId: String) {
        viewModelScope.launch {
            try {
                downloadRepository.deleteDownload(taskId)
                _uiState.value = _uiState.value.copy(
                    downloads = _uiState.value.downloads.filter { it.id != taskId }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to delete download")
            }
        }
    }

    fun saveFile(taskId: String) {
        viewModelScope.launch {
            try {
                val file = downloadRepository.downloadFile(taskId)
                if (file != null) {
                    shareFile(file)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to save file")
            }
        }
    }

    private fun shareFile(file: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.provider",
            file
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "audio/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(Intent.createChooser(intent, "Share Audio").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
