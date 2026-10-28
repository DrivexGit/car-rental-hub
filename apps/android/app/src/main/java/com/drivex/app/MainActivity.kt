package com.drivex.app

import android.content.Intent
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
        setContent { DrivexRoot() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    /** A Drivex site link (from WhatsApp, an email) opens the same page in the app. */
    private fun handleLink(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        if (uri.host != AppConfig.siteHost) return
        val path = (uri.path ?: "/") + (uri.fragment?.let { "#$it" } ?: "")
        val payment = uri.getQueryParameter("payment")
        if (payment != null) AppStore.scope.launch { AppStore.confirmPayment(payment) }
        Router.open(path)
    }
}
