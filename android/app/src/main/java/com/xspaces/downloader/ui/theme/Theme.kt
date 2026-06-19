package com.xspaces.downloader.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// X Branding Colors
val XBlack = Color(0xFF000000)
val XWhite = Color(0xFFFFFFFF)

// Dark Theme Colors
val Gray950 = Color(0xFF030712)
val Gray900 = Color(0xFF111827)
val Gray800 = Color(0xFF1F2937)
val Gray700 = Color(0xFF374151)
val Gray600 = Color(0xFF4B5563)
val Gray500 = Color(0xFF6B7280)
val Gray400 = Color(0xFF9CA3AF)

// Status Colors
val Green500 = Color(0xFF22C55E)
val Red500 = Color(0xFFEF4444)
val Red900 = Color(0xFF7F1D1D)

private val DarkColorScheme = darkColorScheme(
    primary = XWhite,
    onPrimary = XBlack,
    primaryContainer = Gray800,
    onPrimaryContainer = XWhite,
    secondary = Gray400,
    onSecondary = Gray900,
    secondaryContainer = Gray800,
    onSecondaryContainer = Gray400,
    background = Gray950,
    onBackground = XWhite,
    surface = Gray900,
    onSurface = XWhite,
    surfaceVariant = Gray800,
    onSurfaceVariant = Gray400,
    error = Red500,
    onError = XWhite,
    errorContainer = Red900,
    onErrorContainer = Red500,
)

@Composable
fun XSpacesDownloaderTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme // Always use dark theme for X aesthetic
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Gray950.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
