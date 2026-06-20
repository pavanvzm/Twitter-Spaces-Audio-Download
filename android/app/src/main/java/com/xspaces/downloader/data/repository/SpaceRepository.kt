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
        // GraphQL query ID for AudioSpaceById - extracted from Twitter's client
        private const val QUERY_ID = "zMbdEMdMLmsp0ZHRV6yH9g"
        
        // Twitter GraphQL endpoint
        private const val GRAPHQL_URL = "https://twitter.com/i/api/graphql/$QUERY_ID/AudioSpaceById"
        
        // Bearer token (public token used by Twitter web)
        private const val BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8x7P7V2m4m8X5Rt3Nj9K3ayPIBuXrsICpwz3pY3TxqCQWE3mX2VnAEVcpLVu9k0vBBxNw7Y2kxLEQqSptZkEDXLwhr3GV3FCb8J6g6w1X6V2nB9p40f5Qq7s3u7dP4TJJHY4V5QO8p3v1O6p5x7j9Q3F8q2h5g4j0z1m2p3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8"
    }

    suspend fun parseSpaceUrl(url: String): SpaceParseResult = withContext(Dispatchers.IO) {
        // Support multiple URL formats
        val patterns = listOf(
            Pattern.compile("^https?://(twitter\\.com|x\\.com)/i/spaces/([A-Za-z0-9]+)"),
            Pattern.compile("^https?://(twitter\\.com|x\\.com)/.*/spaces/([A-Za-z0-9]+)")
        )
        
        var spaceId: String? = null
        for (pattern in patterns) {
            val matcher = pattern.matcher(url)
            if (matcher.find()) {
                spaceId = matcher.group(2)
                break
            }
        }

        if (spaceId == null) {
            return@withContext SpaceParseResult(
                success = false,
                spaceId = null,
                normalizedUrl = null,
                error = "Invalid Space URL format. Use: twitter.com/i/spaces/XXXXX"
            )
        }

        SpaceParseResult(
            success = true,
            spaceId = spaceId,
            normalizedUrl = "https://twitter.com/i/spaces/$spaceId"
        )
    }

    /**
     * Fetch Space metadata directly from Twitter API
     * This requires a valid guest token or user auth token
     */
    suspend fun getSpaceMetadata(spaceId: String, authToken: String? = null): Result<Space> = withContext(Dispatchers.IO) {
        try {
            // First, get a guest token
            val guestToken = getGuestToken()
            if (guestToken == null) {
                return@withContext Result.failure(Exception("Failed to get guest token. Please try again."))
            }

            // Build GraphQL query
            val query = buildGraphQLQuery(spaceId)
            
            // Make the API call
            val jsonResponse = fetchGraphQL(GRAPHQL_URL, query, guestToken)
            
            // Parse the response
            val space = parseGraphQLResponse(jsonResponse, spaceId)
            
            Result.success(space)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun getGuestToken(): String? = withContext(Dispatchers.IO) {
        try {
            val url = java.net.URL("https://api.twitter.com/1.1/guest/activate.json")
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Authorization", "Bearer $BEARER_TOKEN")
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            
            if (connection.responseCode == 200) {
                val response = connection.inputStream.bufferedReader().readText()
                val json = org.json.JSONObject(response)
                json.optString("guest_token", null)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun buildGraphQLQuery(spaceId: String): String {
        val variables = """
            {
                "id": "$spaceId",
                "isMetatagsQuery": false,
                "withDownvotePerspective": false,
                "withReactionsMetadata": false,
                "withReactionsPerspective": false,
                "withScheduledSpaces": false,
                "withSuperFollowsRelationshipFields": false
            }
        """.trimIndent()

        return """
            {
                "queryId": "$QUERY_ID",
                "variables": $variables,
                "features": {
                    "spaces_2022_h2_spaces_communities": false,
                    "dont_mention_me_view_api_enabled": false,
                    "interactive_text_enabled": false,
                    "responsive_web_graphql_exclude_protected_error_category": true,
                    "responsive_web_graphql_skip_user_profile_image_extensions": false,
                    "responsive_web_graphql_timeline_navigation_enabled": false,
                    "standardize_lcase_media_in_cards": false,
                    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": false,
                    "view_counts_everywhere_api_enabled": false
                }
            }
        """.trimIndent()
    }

    private suspend fun fetchGraphQL(url: String, query: String, guestToken: String): String = withContext(Dispatchers.IO) {
        val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $BEARER_TOKEN")
        connection.setRequestProperty("x-guest-token", guestToken)
        connection.setRequestProperty("x-twitter-active-user", "yes")
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36")
        connection.doOutput = true
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        
        // Write query
        connection.outputStream.write(query.toByteArray())
        
        if (connection.responseCode == 200) {
            connection.inputStream.bufferedReader().readText()
        } else {
            val errorMsg = connection.errorStream?.bufferedReader()?.readText() ?: "Unknown error"
            throw Exception("API Error ${connection.responseCode}: $errorMsg")
        }
    }

    private fun parseGraphQLResponse(jsonResponse: String, spaceId: String): Space {
        val json = org.json.JSONObject(jsonResponse)
        
        // Check for GraphQL errors
        if (json.has("errors")) {
            val errors = json.getJSONArray("errors")
            if (errors.length() > 0) {
                val error = errors.getJSONObject(0)
                throw Exception(error.optString("message", "GraphQL error"))
            }
        }
        
        val audioSpace = json.getJSONObject("data").optJSONObject("audioSpace")
            ?: throw Exception("Space not found or not accessible")
        
        val metadata = audioSpace.optJSONObject("metadata") ?: org.json.JSONObject()
        val creators = audioSpace.optJSONObject("creators")
        val participants = audioSpace.optJSONObject("participants")
        
        // Extract host info
        val users = creators?.optJSONObject("users")?.optJSONArray("results")
        val hostJson = users?.optJSONObject(0) ?: org.json.JSONObject()
        
        val host = SpaceHost(
            id = hostJson.optString("id", ""),
            name = hostJson.optString("name", "Unknown"),
            username = hostJson.optString("screen_name", "unknown"),
            avatarUrl = hostJson.optString("profile_image_url", "")
        )
        
        // Extract speakers
        val speakers = mutableListOf<SpaceHost>()
        val speakerUsers = participants?.optJSONObject("speakers")
            ?.optJSONObject("users")
            ?.optJSONArray("results")
        
        speakerUsers?.let { array ->
            for (i in 0 until array.length()) {
                val user = array.getJSONObject(i)
                speakers.add(SpaceHost(
                    id = user.optString("id", ""),
                    name = user.optString("name", ""),
                    username = user.optString("screen_name", ""),
                    avatarUrl = user.optString("profile_image_url", "")
                ))
            }
        }
        
        // Map status
        val state = metadata.optString("state", "Unknown")
        val status = when (state) {
            "SpaceStatus.Live" -> SpaceStatus.LIVE
            "SpaceStatus.LiveEnded" -> SpaceStatus.ENDED
            "SpaceStatus.NotStarted" -> SpaceStatus.SCHEDULED
            else -> SpaceStatus.UNKNOWN
        }
        
        // Extract stream URL
        val streamUrl = metadata.optString("liveArchiveUrl", null)
        
        // Calculate duration
        val startedAt = metadata.optString("startedAt", null)
        val endedAt = metadata.optString("endedAt", null)
        val duration = calculateDuration(startedAt, endedAt)
        
        return Space(
            id = spaceId,
            title = metadata.optString("title", "Untitled Space"),
            host = host,
            status = status,
            startedAt = startedAt,
            endedAt = endedAt,
            duration = duration,
            participantCount = participants?.optJSONObject("listeners")?.optInt("count", 0) ?: 0,
            speakers = speakers,
            thumbnailUrl = null,
            streamUrl = streamUrl
        )
    }

    private fun calculateDuration(startedAt: String?, endedAt: String?): Long? {
        if (startedAt == null) return null
        try {
            val startTime = java.time.Instant.parse(startedAt)
            val endTime = if (endedAt != null) java.time.Instant.parse(endedAt) else java.time.Instant.now()
            return java.time.Duration.between(startTime, endTime).seconds
        } catch (e: Exception) {
            return null
        }
    }
}
