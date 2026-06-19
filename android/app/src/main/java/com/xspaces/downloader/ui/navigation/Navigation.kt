package com.xspaces.downloader.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.screen
import com.xspaces.downloader.ui.screens.DownloadsScreen
import com.xspaces.downloader.ui.screens.HomeScreen
import com.xspaces.downloader.ui.screens.LoginScreen
import com.xspaces.downloader.ui.screens.SplashScreen

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object Home : Screen("home")
    object Downloads : Screen("downloads")
}

@Composable
fun AppNavigation(
    navController: NavHostController,
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val authState by authViewModel.authState.collectAsState()
    val isLoading by authViewModel.isLoading.collectAsState()

    // Handle OAuth callback
    LaunchedEffect(Unit) {
        navController.currentBackStackEntry?.arguments?.getString("code")?.let { code ->
            authViewModel.handleCallback(code)
        }
    }

    val startDestination = when {
        isLoading -> Screen.Splash.route
        authState.accessToken != null -> Screen.Home.route
        else -> Screen.Login.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Splash.route) {
            SplashScreen()
        }

        composable(Screen.Login.route) {
            LoginScreen(
                onLoginClick = { authViewModel.login() },
                isLoading = isLoading
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                onLogout = { authViewModel.logout() },
                user = authState.user
            )
        }

        composable(Screen.Downloads.route) {
            DownloadsScreen()
        }
    }
}
