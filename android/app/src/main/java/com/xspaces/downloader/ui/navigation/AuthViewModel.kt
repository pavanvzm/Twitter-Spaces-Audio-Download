package com.xspaces.downloader.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.xspaces.downloader.data.model.AuthState
import com.xspaces.downloader.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _authState = MutableStateFlow(AuthState())
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        checkAuthState()
    }

    private fun checkAuthState() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val state = authRepository.getAuthState()
                _authState.value = state
                
                // Check if token needs refresh
                if (state.accessToken != null && state.expiresAt != null) {
                    val fiveMinutesFromNow = System.currentTimeMillis() + (5 * 60 * 1000)
                    if (state.expiresAt < fiveMinutesFromNow) {
                        refreshToken()
                    }
                }
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun login() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val authUrl = authRepository.getLoginUrl()
                // Open auth URL in browser
                // This would typically use a CustomTabsIntent or WebView
            } catch (e: Exception) {
                _error.value = "Failed to initiate login"
            }
        }
    }

    fun handleCallback(code: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val result = authRepository.handleCallback(code)
                _authState.value = AuthState(
                    user = result.user,
                    accessToken = result.accessToken,
                    refreshToken = result.refreshToken,
                    expiresAt = result.expiresAt
                )
            } catch (e: Exception) {
                _error.value = "Authentication failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun refreshToken() {
        viewModelScope.launch {
            try {
                authRepository.refreshToken()
                checkAuthState()
            } catch (e: Exception) {
                // Token refresh failed, clear auth
                logout()
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _authState.value = AuthState()
        }
    }

    fun clearError() {
        _error.value = null
    }
}
