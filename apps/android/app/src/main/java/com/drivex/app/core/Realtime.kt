package com.drivex.app.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * Supabase Realtime, for one thing: a new notification row for this customer (a new invoice, fine or booking update),
 * which reloads the data, as the site does. Speaks the Phoenix channel protocol over a web socket, reconnects on its own.
 */
class NotificationFeed(private val customerId: String, private val onInsert: () -> Unit) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var socket: WebSocket? = null
    private var loop: Job? = null
    private var ref = 0

    fun start() {
        loop = scope.launch {
            while (isActive) {
                val closed = kotlinx.coroutines.CompletableDeferred<Unit>()
                connect(closed)
                // heartbeat every 25 s until the socket closes
                while (isActive && !closed.isCompleted) {
                    delay(25_000)
                    socket?.send(msg("phoenix", "heartbeat", "{}"))
                }
                delay(5_000) // then try again
            }
        }
    }

    fun stop() {
        loop?.cancel()
        socket?.close(1000, null)
        socket = null
    }

    private fun msg(topic: String, event: String, payload: String) =
        """{"topic":"$topic","event":"$event","payload":$payload,"ref":"${++ref}"}"""

    private suspend fun connect(closed: kotlinx.coroutines.CompletableDeferred<Unit>) {
        val token = Auth.token() ?: run { closed.complete(Unit); return }
        val wss = AppConfig.supabaseUrl.replaceFirst("https://", "wss://") + "/realtime/v1/websocket?apikey=${AppConfig.supabaseKey}&vsn=1.0.0"
        socket = http.newWebSocket(Request.Builder().url(wss).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val config = toJson(mapOf(
                    "config" to mapOf(
                        "broadcast" to mapOf("self" to false), "presence" to mapOf("key" to ""),
                        "postgres_changes" to listOf(mapOf("event" to "INSERT", "schema" to "public", "table" to "notifications", "filter" to "customer_id=eq.$customerId")),
                    ),
                    "access_token" to token,
                ))
                webSocket.send(msg("realtime:me", "phx_join", config.toString()))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (J.parse(text)["event"].string == "postgres_changes") onInsert()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { closed.complete(Unit) }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { closed.complete(Unit) }
        })
    }
}
