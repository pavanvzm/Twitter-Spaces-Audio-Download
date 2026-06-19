package com.xspaces.downloader.data.model

data class Space(
    val id: String,
    val title: String,
    val host: SpaceHost,
    val status: SpaceStatus,
    val startedAt: String?,
    val endedAt: String?,
    val duration: Long?,
    val participantCount: Int,
    val speakers: List<SpaceHost>,
    val thumbnailUrl: String?,
    val streamUrl: String?
)

data class SpaceHost(
    val id: String,
    val name: String,
    val username: String,
    val avatarUrl: String
)

enum class SpaceStatus {
    LIVE,
    ENDED,
    SCHEDULED,
    UNKNOWN;

    companion object {
        fun fromString(status: String?): SpaceStatus {
            return when (status?.lowercase()) {
                "live" -> LIVE
                "ended" -> ENDED
                "scheduled" -> SCHEDULED
                else -> UNKNOWN
            }
        }
    }
}

data class SpaceParseResult(
    val success: Boolean,
    val spaceId: String?,
    val normalizedUrl: String?,
    val error: String? = null
)
