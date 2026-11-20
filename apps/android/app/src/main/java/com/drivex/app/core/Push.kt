package com.drivex.app.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.drivex.app.BuildConfig
import com.drivex.app.MainActivity
import com.drivex.app.R
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Push notifications (Firebase Cloud Messaging), shown even when the app is closed. The phone's token is stored in
 * push_subscriptions (rpc register_device) and the server's push hook sends to it, next to the site's web push.
 * Off when the FCM values are missing from secrets.properties.
 */
object Push {
    const val CHANNEL = "drivex"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var on = false
    private var prefs: android.content.SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences("drivex.push", Context.MODE_PRIVATE)
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, t("Notifications"), NotificationManager.IMPORTANCE_HIGH))
        if (BuildConfig.FCM_APP_ID.isEmpty() || BuildConfig.FCM_API_KEY.isEmpty() || BuildConfig.FCM_PROJECT_ID.isEmpty()) return
        if (FirebaseApp.getApps(context).isEmpty()) FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.FCM_APP_ID).setApiKey(BuildConfig.FCM_API_KEY)
            .setProjectId(BuildConfig.FCM_PROJECT_ID).setGcmSenderId(BuildConfig.FCM_SENDER_ID).build())
        on = true
    }

    /** After sign-in and on every start: (re)stores this phone's token for the signed-in customer. */
    fun register(token: String? = null) {
        if (!on || Auth.userId == null) return
        val save = { tk: String ->
            prefs?.edit()?.putString("token", tk)?.apply()
            scope.launch { runCatching { Db.rpc("register_device", mapOf("p_token" to tk, "p_platform" to "fcm")) } }; Unit
        }
        if (token != null) save(token) else FirebaseMessaging.getInstance().token.addOnSuccessListener { save(it) }
    }

    /** Before sign-out (still signed in): this phone's row goes, then the token itself, so it gets nothing more for that customer. */
    suspend fun unregister() {
        if (!on) return
        prefs?.getString("token", null)?.let { tk -> runCatching { Db.delete("push_subscriptions", "endpoint" to "eq.$tk") } }
        prefs?.edit()?.remove("token")?.apply()
        runCatching { FirebaseMessaging.getInstance().deleteToken() }
    }

    /** Opens the page a notification points to ("/bookings/<id>#invoice"), through MainActivity's link handling. */
    fun openIntent(context: Context, path: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (!path.isNullOrEmpty()) intent.data = Uri.parse(AppConfig.url(path))
        return PendingIntent.getActivity(context, path.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
}

/** Receives the pushes. With the app closed Android shows them itself; with it open they are shown here. */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = Push.register(token)

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification ?: return
        val url = message.data["url"]
        val note = NotificationCompat.Builder(this, Push.CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setColor(getColor(R.color.brand))
            .setContentTitle(n.title).setContentText(n.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(n.body))
            .setAutoCancel(true)
            .setContentIntent(Push.openIntent(this, url))
            .build()
        runCatching { NotificationManagerCompat.from(this).notify(n.tag ?: url ?: "drivex", 0, note) } // no permission: skipped
    }
}
