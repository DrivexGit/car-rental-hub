package com.drivex.app.core

import android.content.Context
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/** A message for the customer, already translated. */
class AppError(message: String) : Exception(message)

private val JSON_TYPE = "application/json".toMediaType()

/** One HTTP client for the app (Supabase, the site's /api, pictures go through Coil). */
val http: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .build()

private suspend fun call(req: Request): Pair<Int, String> = withContext(Dispatchers.IO) {
    try {
        http.newCall(req).execute().use { r: Response -> r.code to (r.body?.string() ?: "") }
    } catch (e: IOException) {
        throw AppError(t("Something went wrong. Please try again."))
    }
}

/**
 * The customer's Supabase session (from the site's sign-in: api/auth returns the tokens), kept in the app's private
 * storage (excluded from backups) and refreshed before it runs out, like supabase-js does on the site.
 */
object Auth {
    private var prefs: android.content.SharedPreferences? = null
    private val lock = Mutex()
    private var access: String? = null
    private var refresh: String? = null
    private var expiresAt = 0L

    /** The signed-in customer's id, or null. Compose state, so screens follow sign-in and sign-out. */
    var userId by mutableStateOf<String?>(null)
        private set

    fun init(context: Context) {
        prefs = context.getSharedPreferences("drivex.auth", Context.MODE_PRIVATE)
        access = prefs!!.getString("access", null)
        refresh = prefs!!.getString("refresh", null)
        expiresAt = prefs!!.getLong("expires", 0)
        userId = access?.let { claims(it)["sub"].string }
    }

    private fun claims(jwt: String): J = runCatching {
        J.parse(String(Base64.decode(jwt.split(".")[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)))
    }.getOrDefault(J(null))

    private fun save(a: String?, r: String?) {
        access = a; refresh = r
        expiresAt = a?.let { (claims(it)["exp"].double ?: 0.0).toLong() } ?: 0L
        prefs?.edit()?.putString("access", a)?.putString("refresh", r)?.putLong("expires", expiresAt)?.apply()
        userId = a?.let { claims(it)["sub"].string }
    }

    fun setSession(accessToken: String, refreshToken: String) = save(accessToken, refreshToken)

    /** A valid access token, refreshed when it ends within a minute; null when signed out (or the refresh was refused). */
    suspend fun token(): String? = lock.withLock {
        val a = access ?: return null
        if (expiresAt - System.currentTimeMillis() / 1000 > 60) return a
        val r = refresh ?: return null
        val req = Request.Builder().url("${AppConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token")
            .header("apikey", AppConfig.supabaseKey)
            .post(toJson(mapOf("refresh_token" to r)).toString().toRequestBody(JSON_TYPE)).build()
        val (code, body) = try { call(req) } catch (e: AppError) { return a } // offline: keep the old token, a later call retries
        if (code in 200..299) {
            val out = J.parse(body)
            save(out["access_token"].string, out["refresh_token"].string)
            return access
        }
        if (code in 400..499) save(null, null) // the session was revoked or expired for good
        return null
    }

    suspend fun signOut() {
        val a = access
        save(null, null)
        if (a != null) runCatching {
            call(Request.Builder().url("${AppConfig.supabaseUrl}/auth/v1/logout?scope=local").header("apikey", AppConfig.supabaseKey)
                .header("Authorization", "Bearer $a").post(ByteArray(0).toRequestBody()).build())
        }
    }
}

/** Supabase's REST API (PostgREST): the same tables, filters and row-level security as the site. */
object Db {
    private suspend fun request(url: HttpUrl, method: String, body: RequestBody? = null, prefer: String? = null): String {
        val b = Request.Builder().url(url)
            .header("apikey", AppConfig.supabaseKey)
            .header("Authorization", "Bearer ${Auth.token() ?: AppConfig.supabaseKey}")
            .method(method, body)
        if (prefer != null) b.header("Prefer", prefer)
        val (code, text) = call(b.build())
        if (code !in 200..299) throw AppError(J.parse(text)["message"].text ?: t("Something went wrong. Please try again."))
        return text
    }

    private fun url(path: String, params: List<Pair<String, String>>): HttpUrl =
        "${AppConfig.supabaseUrl}/rest/v1/$path".toHttpUrl().newBuilder().apply { params.forEach { (k, v) -> addQueryParameter(k, v) } }.build()

    /** select(table, "select" to "*", "id" to "eq.$id", "order" to "created_at.desc") */
    suspend fun select(table: String, vararg params: Pair<String, String>): List<J> =
        J.parse(request(url(table, params.toList()), "GET")).array

    suspend fun update(table: String, values: Map<String, Any?>, vararg filters: Pair<String, String>) {
        request(url(table, filters.toList()), "PATCH", toJson(values).toString().toRequestBody(JSON_TYPE), "return=minimal")
    }

    suspend fun insert(table: String, values: Map<String, Any?>, select: String = "id"): List<J> =
        J.parse(request(url(table, listOf("select" to select)), "POST", toJson(values).toString().toRequestBody(JSON_TYPE), "return=representation")).array

    suspend fun rpc(name: String, args: Map<String, Any?>): J =
        J.parse(request(url("rpc/$name", emptyList()), "POST", toJson(args).toString().toRequestBody(JSON_TYPE)))
}

/** Supabase Storage: avatars (public), customer documents and invoices (private, signed links). */
object Storage {
    private suspend fun authed(b: Request.Builder): Request =
        b.header("apikey", AppConfig.supabaseKey).header("Authorization", "Bearer ${Auth.token() ?: AppConfig.supabaseKey}").build()

    private fun objectUrl(bucket: String, path: String) = "${AppConfig.supabaseUrl}/storage/v1/object/$bucket/${path.split("/").joinToString("/") { android.net.Uri.encode(it) }}"

    suspend fun upload(bucket: String, path: String, bytes: ByteArray, contentType: String, upsert: Boolean = false) {
        val (code, text) = call(authed(Request.Builder().url(objectUrl(bucket, path))
            .header("x-upsert", upsert.toString()).header("cache-control", "max-age=3600")
            .post(bytes.toRequestBody(contentType.toMediaType()))))
        if (code !in 200..299) throw AppError(J.parse(text)["message"].text ?: t("Something went wrong. Please try again."))
    }

    fun publicUrl(bucket: String, path: String) = "${AppConfig.supabaseUrl}/storage/v1/object/public/$bucket/$path"

    suspend fun signedUrl(bucket: String, path: String, seconds: Int = 300): String {
        val (code, text) = call(authed(Request.Builder().url("${AppConfig.supabaseUrl}/storage/v1/object/sign/$bucket/$path")
            .post(toJson(mapOf("expiresIn" to seconds)).toString().toRequestBody(JSON_TYPE))))
        val signed = J.parse(text)["signedURL"].text
        if (code !in 200..299 || signed == null) throw AppError(t("Could not open the invoice. Please try again."))
        return "${AppConfig.supabaseUrl}/storage/v1$signed"
    }

    suspend fun remove(bucket: String, paths: List<String>) {
        call(authed(Request.Builder().url("${AppConfig.supabaseUrl}/storage/v1/object/$bucket")
            .delete(toJson(mapOf("prefixes" to paths)).toString().toRequestBody(JSON_TYPE))))
    }

    /** Downloads a file (a signed link) as bytes. */
    suspend fun download(url: String): ByteArray = withContext(Dispatchers.IO) {
        try {
            http.newCall(Request.Builder().url(url).build()).execute().use { r ->
                if (!r.isSuccessful) throw AppError(t("Could not open the invoice. Please try again."))
                r.body!!.bytes()
            }
        } catch (e: IOException) { throw AppError(t("Could not open the invoice. Please try again.")) }
    }
}

/** The site's server functions (apps/customer/api), called with the customer's session, like `api()` in src/lib/supabase.ts. */
object Api {
    suspend fun post(path: String, body: Map<String, Any?>): J {
        val b = Request.Builder().url("${AppConfig.siteUrl}/api/$path")
            .post(toJson(body).toString().toRequestBody(JSON_TYPE))
        Auth.token()?.let { b.header("authorization", "Bearer $it") }
        val (code, text) = call(b.build())
        val out = J.parse(text)
        if (code == 429) throw AppError(t("Too many attempts. Please wait a few minutes and try again."))
        if (code !in 200..299) throw AppError(out["error"].text?.let { t(it) } ?: t("Something went wrong. Please try again."))
        return out
    }
}
