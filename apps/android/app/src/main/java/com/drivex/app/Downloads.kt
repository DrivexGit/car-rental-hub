package com.drivex.app

import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.URLUtil
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File

/** Saves files the page hands over (invoice PDFs, documents) to the phone's Downloads folder. */
object Downloads {

    /** A file on a web server: Android's download manager fetches it (with the site's cookies) and notifies when done. */
    fun fromUrl(context: Context, url: String, suggestedName: String?, userAgent: String?, contentDisposition: String? = null, mimeType: String? = null) {
        val name = cleanName(suggestedName) ?: URLUtil.guessFileName(url, contentDisposition, mimeType)
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(name)
            .setMimeType(mimeType ?: mimeFor(name))
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
        userAgent?.let { request.addRequestHeader("User-Agent", it) }
        runCatching { (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request) }
            .onSuccess { toast(context, context.getString(R.string.download_started, name)) }
            .onFailure { toast(context, context.getString(R.string.download_failed)) }
    }

    /** A file the page made itself (a `data:` URL, e.g. the invoice PDF drawn in the browser): written to Downloads, then opened. */
    fun fromDataUrl(context: Context, dataUrl: String, suggestedName: String?) {
        val comma = dataUrl.indexOf(',')
        if (!dataUrl.startsWith("data:") || comma < 0) return toast(context, context.getString(R.string.download_failed))
        val header = dataUrl.substring(5, comma)
        val mime = header.substringBefore(';').ifBlank { "application/octet-stream" }
        val bytes = runCatching {
            val body = dataUrl.substring(comma + 1)
            if (header.endsWith(";base64")) Base64.decode(body, Base64.DEFAULT) else Uri.decode(body).toByteArray()
        }.getOrElse { return toast(context, context.getString(R.string.download_failed)) }
        val name = cleanName(suggestedName) ?: "drivex-${System.currentTimeMillis()}.${MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"}"

        val uri = runCatching { save(context, bytes, name, mime) }.getOrNull()
            ?: return toast(context, context.getString(R.string.download_failed))
        toast(context, context.getString(R.string.download_saved, name))
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) { /* saved; no app to open it */ }
    }

    private fun save(context: Context, bytes: ByteArray, name: String, mime: String): Uri {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("no download entry")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("cannot write")
            resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
            return uri
        }
        // Android 8–9: the app's own Downloads folder (no storage permission needed), shared through the FileProvider
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        val file = File(dir, name).apply { writeBytes(bytes) }
        return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    }

    /** Keeps a plain file name: no folders, no characters Android's file systems refuse. */
    internal fun cleanName(name: String?): String? =
        name?.substringAfterLast('/')?.replace(Regex("""[\\:*?"<>|\u0000-\u001f]"""), "_")?.trim()?.takeIf { it.isNotEmpty() && it != "." && it != ".." }

    private fun mimeFor(name: String) =
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase()) ?: "application/octet-stream"

    private fun toast(context: Context, text: String) = Toast.makeText(context, text, Toast.LENGTH_SHORT).show()
}
