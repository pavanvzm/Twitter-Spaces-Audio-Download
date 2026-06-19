package com.xspaces.downloader.data.repository

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.xspaces.downloader.data.model.AuthState
import com.xspaces.downloader.data.model.User
import com.xspaces.downloader.data.model.AuthResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.openid.appauth.AuthorizationService
import net.openid.appauth.TokenRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "x_auth_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_USERNAME = "user_username"
        private const val KEY_USER_AVATAR = "user_avatar"
        
        private const val CLIENT_ID = "YOUR_X_CLIENT_ID" // Replace with actual client ID
        private const val REDIRECT_URI = "xspacesdownloader://callback"
        private const val SCOPE = "tweet.read users.read offline.access"
    }

    suspend fun getAuthState(): AuthState = withContext(Dispatchers.IO) {
        val accessToken = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
        val refreshToken = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        val expiresAt = sharedPreferences.getLong(KEY_EXPIRES_AT, 0)
        val userId = sharedPreferences.getString(KEY_USER_ID, null)
        val userName = sharedPreferences.getString(KEY_USER_NAME, null)
        val userUsername = sharedPreferences.getString(KEY_USER_USERNAME, null)
        val userAvatar = sharedPreferences.getString(KEY_USER_AVATAR, null)

        val user = if (userId != null && userName != null && userUsername != null) {
            User(
                id = userId,
                name = userName,
                username = userUsername,
                avatarUrl = userAvatar ?: ""
            )
        } else null

        AuthState(
            user = user,
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAt = expiresAt
        )
    }

    suspend fun getLoginUrl(): String = withContext(Dispatchers.IO) {
        // In production, use AppAuth library to build proper OAuth URL
        // For now, return placeholder
        "https://twitter.com/i/oauth2/authorize?client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&scope=$SCOPE&response_type=code"
    }

    suspend fun handleCallback(code: String): AuthResult = withContext(Dispatchers.IO) {
        // In production, exchange code for tokens via backend
        // This is a simplified version
        val response = """{
            "access_token": "mock_access_token_$code",
            "refresh_token": "mock_refresh_token",
            "expires_in": 7200
        }""".trimIndent()

        // Parse response and store tokens
        saveAuthData(
            accessToken = "mock_access_token_$code",
            refreshToken = "mock_refresh_token",
            expiresIn = 7200,
            user = User(
                id = "12345",
                name = "X User",
                username = "xuser",
                avatarUrl = ""
            )
        )

        AuthResult(
            user = User(id = "12345", name = "X User", username = "xuser", avatarUrl = ""),
            accessToken = "mock_access_token_$code",
            refreshToken = "mock_refresh_token",
            expiresAt = System.currentTimeMillis() + (7200 * 1000)
        )
    }

    suspend fun refreshToken(): Boolean = withContext(Dispatchers.IO) {
        val refreshToken = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        
        if (refreshToken == null) return@withContext false

        // In production, call backend to refresh token
        // For now, simulate success
        true
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        sharedPreferences.edit().clear().apply()
    }

    private fun saveAuthData(
        accessToken: String,
        refreshToken: String,
        expiresIn: Int,
        user: User
    ) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_EXPIRES_AT, System.currentTimeMillis() + (expiresIn * 1000))
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_USER_NAME, user.name)
            .putString(KEY_USER_USERNAME, user.username)
            .putString(KEY_USER_AVATAR, user.avatarUrl)
            .apply()
    }
}

data class AuthResult(
    val user: User,
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long
)
