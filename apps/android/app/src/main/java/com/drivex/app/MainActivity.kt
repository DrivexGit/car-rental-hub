package com.drivex.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.drivex.app.core.AppConfig
import com.drivex.app.core.Auth
import com.drivex.app.data.AppStore
import com.drivex.app.ui.DrivexRoot
import com.drivex.app.ui.Router
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen() // the system launch screen: the white mark on the brand green, then the app's own splash
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        if (AppConfig.isConfigured && savedInstanceState == null) AppStore.refreshLater()
        // back in the app: the data may have changed (a payment, a new invoice)
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            private var first = true
            override fun onStart(owner: LifecycleOwner) {
                if (!first && Auth.userId != null) AppStore.refreshLater()
                first = false
            }
        })
        handleLink(intent)
        setContent {
            LaunchedEffect(Auth.userId) { askForNotifications() } // on start, and right after sign-in
            DrivexRoot()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    // Android 13+: pushes need the customer's yes. Asked once they are signed in (the system asks at most twice).
    private val notifyPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private fun askForNotifications() {
        if (Build.VERSION.SDK_INT < 33 || Auth.userId == null) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            notifyPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** A Drivex site link (from WhatsApp, an email, or a tapped push) opens the same page in the app. */
    private fun handleLink(intent: Intent?) {
        // a push tapped while the app was closed: Android opens the app with the push's data as extras
        val pushed = intent?.getStringExtra("url")?.takeIf { it.startsWith("/") }
        if (pushed != null && intent.data == null) { Router.open(pushed); return }
        val uri: Uri = intent?.data ?: return
        if (uri.host != AppConfig.siteHost) return
        val path = (uri.path ?: "/") + (uri.fragment?.let { "#$it" } ?: "")
        val payment = uri.getQueryParameter("payment")
        if (payment != null && Auth.userId != null) AppStore.scope.launch { AppStore.confirmPayment(payment) }
        Router.open(path)
    }
}
