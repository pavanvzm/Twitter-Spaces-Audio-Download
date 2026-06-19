package com.xspaces.downloader.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xspaces.downloader.data.model.DownloadStatus
import com.xspaces.downloader.data.model.DownloadTask
import com.xspaces.downloader.data.model.Space
import com.xspaces.downloader.data.repository.DownloadRepository
import com.xspaces.downloader.data.repository.SpaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class HomeUiState(
    val spaceUrl: String = "",
    val format: String = "mp3",
    val spaceInfo: Space? = null,
    val isValidating: Boolean = false,
    val isDownloading: Boolean = false,
    val activeDownload: DownloadTask? = null,
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val spaceRepository: SpaceRepository,
    private val downloadRepository: DownloadRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var validationJob: Job? = null
    private var pollJob: Job? = null

    fun updateSpaceUrl(url: String) {
        _uiState.update { it.copy(spaceUrl = url, spaceInfo = null, error = null) }
        
        // Debounce validation
        validationJob?.cancel()
        if (url.isNotBlank()) {
            validationJob = viewModelScope.launch {
                delay(500) // Debounce
                validateUrl(url)
            }
        }
    }

    fun updateFormat(format: String) {
        _uiState.update { it.copy(format = format) }
    }

    private suspend fun validateUrl(url: String) {
        _uiState.update { it.copy(isValidating = true, error = null) }

        try {
            val parseResult = spaceRepository.parseSpaceUrl(url)
            
            if (!parseResult.success || parseResult.spaceId == null) {
                _uiState.update { 
                    it.copy(
                        isValidating = false,
                        error = parseResult.error ?: "Invalid Space URL"
                    )
                }
                return
            }

            val space = spaceRepository.getSpaceMetadata(parseResult.spaceId)
            _uiState.update { it.copy(isValidating = false, spaceInfo = space) }
        } catch (e: Exception) {
            _uiState.update { 
                it.copy(
                    isValidating = false,
                    error = e.message ?: "Failed to validate URL"
                )
            }
        }
    }

    fun startDownload() {
        val spaceInfo = _uiState.value.spaceInfo ?: return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isDownloading = true, error = null) }

            try {
                val result = downloadRepository.startDownload(
                    spaceId = spaceInfo.id,
                    format = _uiState.value.format
                )

                if (result.success && result.taskId != null) {
                    val task = DownloadTask(
                        id = result.taskId,
                        spaceId = spaceInfo.id,
                        metadata = spaceInfo,
                        status = DownloadStatus.PENDING,
                        progress = 0,
                        format = _uiState.value.format,
                        fileSize = null,
                        createdAt = System.currentTimeMillis(),
                        completedAt = null,
                        error = null
                    )
                    _uiState.update { it.copy(activeDownload = task) }
                    pollProgress(result.taskId)
                } else {
                    _uiState.update { 
                        it.copy(
                            isDownloading = false,
                            error = result.error ?: "Failed to start download"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isDownloading = false,
                        error = e.message ?: "Download failed"
                    )
                }
            }
        }
    }

    private fun pollProgress(taskId: String) {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (true) {
                try {
                    val status = downloadRepository.getDownloadStatus(taskId)
                    
                    _uiState.update { state ->
                        state.copy(
                            activeDownload = state.activeDownload?.copy(
                                status = DownloadStatus.fromString(status.status),
                                progress = status.progress,
                                error = status.error,
                                fileSize = status.fileSize
                            ),
                            isDownloading = status.status == "downloading" || status.status == "processing"
                        )
                    }

                    when (status.status) {
                        "completed" -> {
                            _uiState.update { it.copy(isDownloading = false) }
                            break
                        }
                        "failed" -> {
                            _uiState.update { it.copy(isDownloading = false, error = status.error) }
                            break
                        }
                        else -> delay(1000)
                    }
                } catch (e: Exception) {
                    _uiState.update { it.copy(isDownloading = false, error = e.message) }
                    break
                }
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
                _uiState.update { it.copy(error = "Failed to save file") }
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

    override fun onCleared() {
        super.onCleared()
        validationJob?.cancel()
        pollJob?.cancel()
    }
}
