package com.xspaces.downloader.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xspaces.downloader.ui.theme.Gray800
import com.xspaces.downloader.ui.theme.Gray900
import com.xspaces.downloader.ui.theme.Gray400
import com.xspaces.downloader.ui.theme.Green500
import com.xspaces.downloader.ui.theme.XBlack
import com.xspaces.downloader.ui.theme.XWhite

@Composable
fun LoginScreen(
    onLoginClick: () -> Unit,
    isLoading: Boolean
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // X Logo
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(XBlack),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "X",
                color = XWhite,
                fontSize = 48.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Title
        Text(
            text = "X Spaces Downloader",
            style = MaterialTheme.typography.headlineMedium,
            color = XWhite
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Subtitle
        Text(
            text = "Download full recordings of X Spaces\nusing your account",
            style = MaterialTheme.typography.bodyMedium,
            color = Gray400,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(48.dp))

        // Login button
        Button(
            onClick = onLoginClick,
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = XBlack,
                contentColor = XWhite
            ),
            shape = RoundedCornerShape(28.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = XWhite,
                    strokeWidth = 2.dp
                )
            } else {
                Text(
                    text = "X",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Login with X",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Features card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Gray900
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp)
            ) {
                Text(
                    text = "What you'll get:",
                    style = MaterialTheme.typography.titleSmall,
                    color = XWhite,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(16.dp))

                FeatureItem("Download complete Space recordings")
                FeatureItem("High-quality audio in MP3 or WAV format")
                FeatureItem("Space metadata: title, host, participants")
                FeatureItem("No API rate limits (uses your account)")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Privacy notice
        Text(
            text = "We only request read access to your X account.\nYour credentials are never stored.",
            style = MaterialTheme.typography.bodySmall,
            color = Gray400,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun FeatureItem(text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Check,
            contentDescription = null,
            tint = Green500,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = Gray400
        )
    }
}
