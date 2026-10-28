package com.drivex.app.core

import android.net.Uri
import com.drivex.app.BuildConfig

/** Build settings (secrets.properties) and the fixed DriveX contact details (apps/customer/src/config.ts). */
object AppConfig {
    /** The Drivex site: its /api functions, the car pictures and the page Stripe returns to. */
    val siteUrl: String = BuildConfig.SITE_URL.trimEnd('/')
    val siteHost: String = Uri.parse(siteUrl).host ?: ""
    val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/')
    val supabaseKey: String = BuildConfig.SUPABASE_ANON_KEY
    /** False when secrets.properties was not filled in: the app says how to fix it instead of failing. */
    val isConfigured get() = supabaseUrl.startsWith("https://") && supabaseKey.isNotEmpty()

    const val SUPPORT_PHONE = "+971561215152"
    const val WHATSAPP_NUMBER = "971561215152"
    fun whatsappLink(text: String = ""): String =
        "https://wa.me/$WHATSAPP_NUMBER" + if (text.isEmpty()) "" else "?text=" + Uri.encode(text)

    /** Seller details printed on invoices; the tenant settings (TRN, address, bank) override them. */
    object Company {
        const val NAME = "Drivex Car Rental LLC"
        const val ADDRESS = "Dubai, United Arab Emirates"
        const val EMAIL = "info@drivex.ae"
    }

    val version: String = BuildConfig.VERSION_NAME.removeSuffix("-debug")

    /** A site path ("/cars/x.webp") as a full URL; full URLs pass through. */
    fun url(pathOrUrl: String): String =
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) pathOrUrl else siteUrl + pathOrUrl
}
