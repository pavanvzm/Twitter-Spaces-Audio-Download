package com.xspaces.downloader.data.model

data class User(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String
)

data class AuthState(
    val user: User? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val expiresAt: Long? = null
)
