package com.xspaces.downloader.data.repository

import com.xspaces.downloader.data.model.Space
import com.xspaces.downloader.data.model.SpaceHost
import com.xspaces.downloader.data.model.SpaceParseResult
import com.xspaces.downloader.data.model.SpaceStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.regex.Pattern
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SpaceRepository @Inject constructor() {

    companion object {
        private const val BASE_URL = "http://10.0.2.2:3001/api" // localhost for emulator
    }

    suspend fun parseSpaceUrl(url: String): SpaceParseResult = withContext(Dispatchers.IO) {
        // Validate URL format
        val pattern = Pattern.compile(
            "^https?://(twitter\\.com|x\\.com)/.*/spaces/([A-Za-z0-9]+)"
        )
        val matcher = pattern.matcher(url)

        if (!matcher.find()) {
            return@withContext SpaceParseResult(
                success = false,
                spaceId = null,
                normalizedUrl = null,
                error = "Invalid Space URL format"
            )
        }

        val spaceId = matcher.group(2) ?: return@withContext SpaceParseResult(
            success = false,
            spaceId = null,
            normalizedUrl = null,
            error = "Could not extract Space ID"
        )

        SpaceParseResult(
            success = true,
            spaceId = spaceId,
            normalizedUrl = "https://twitter.com/i/spaces/$spaceId"
        )
    }

    suspend fun getSpaceMetadata(spaceId: String): Space = withContext(Dispatchers.IO) {
        // In production, this would call the backend API
        // For now, return mock data
        Space(
            id = spaceId,
            title = "Sample X Space",
            host = SpaceHost(
                id = "12345",
                name = "Space Host",
                username = "spacehost",
                avatarUrl = ""
            ),
            status = SpaceStatus.ENDED,
            startedAt = "2024-01-15T10:00:00Z",
            endedAt = "2024-01-15T11:30:00Z",
            duration = 5400, // 1.5 hours
            participantCount = 150,
            speakers = emptyList(),
            thumbnailUrl = null,
            streamUrl = null
        )
    }
}
