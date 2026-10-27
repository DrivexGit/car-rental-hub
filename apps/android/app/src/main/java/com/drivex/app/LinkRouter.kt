package com.drivex.app

import java.net.URI

/** Where a link the page opens should go. Pure Kotlin (java.net.URI), so it is covered by plain unit tests. */
enum class Route {
    /** Stays in the app: the Drivex site itself and the payment pages that send the customer back to it. */
    IN_APP,
    /** A file (invoice PDF, document) on the storage server: saved to Downloads. */
    DOWNLOAD,
    /** Another app: WhatsApp, phone, mail, maps, the Play Store, or an intent: link. */
    EXTERNAL_APP,
    /** Any other web page: shown in a Chrome Custom Tab, so the customer never leaves Drivex for good. */
    BROWSER_TAB,
    /** Nothing to do (empty, javascript:, blob: and data: links are handled by the page or the download bridge). */
    IGNORE,
}

class LinkRouter(appUrl: String) {
    private val appHost = URI(appUrl).host.lowercase()

    fun route(url: String?): Route {
        if (url.isNullOrBlank()) return Route.IGNORE
        val uri = runCatching { URI(url.trim()) }.getOrNull() ?: return Route.IGNORE
        return when (uri.scheme?.lowercase()) {
            "http", "https" -> web(uri)
            "tel", "mailto", "sms", "smsto", "geo", "whatsapp", "market", "intent" -> Route.EXTERNAL_APP
            "about" -> Route.IN_APP
            else -> Route.IGNORE
        }
    }

    private fun web(uri: URI): Route {
        val host = uri.host?.lowercase() ?: return Route.IGNORE
        val path = uri.path.orEmpty()
        return when {
            host == appHost -> Route.IN_APP
            host.endsWith(".supabase.co") && path.startsWith("/storage/") -> Route.DOWNLOAD
            PAYMENT_HOSTS.any { host == it || host.endsWith(".$it") } -> Route.IN_APP
            APP_HOSTS.any { host == it || host.endsWith(".$it") } -> Route.EXTERNAL_APP
            host.endsWith("google.com") && path.startsWith("/maps") -> Route.EXTERNAL_APP
            else -> Route.BROWSER_TAB
        }
    }

    companion object {
        /** Checkout pages: they must run inside the app so their redirect brings the customer back to the booking. */
        private val PAYMENT_HOSTS = listOf("stripe.com", "stripe.network", "ziina.com")
        /** Links that belong to an installed app rather than to a web page. */
        private val APP_HOSTS = listOf("wa.me", "api.whatsapp.com", "whatsapp.com", "maps.app.goo.gl", "play.google.com")
    }
}
