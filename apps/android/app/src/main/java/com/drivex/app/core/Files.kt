package com.drivex.app.core

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Files the app makes or downloads: invoice PDFs saved to Downloads and opened. */
object Files {
    /** Turns an HTML document into an A4 PDF (12 mm margins). The page is laid out 794 CSS px wide (A4 at 96 dpi), as on the site. */
    @SuppressLint("SetJavaScriptEnabled")
    suspend fun pdfFromHtml(context: Context, html: String): ByteArray = suspendCancellableCoroutine { cont ->
        val density = context.resources.displayMetrics.density
        val width = (794 * density).toInt()
        val web = WebView(context)
        web.settings.javaScriptEnabled = false
        web.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec((1123 * density).toInt(), View.MeasureSpec.EXACTLY))
        web.layout(0, 0, width, (1123 * density).toInt())
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                // give the page a moment to draw its images (the logo is inline)
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        val height = (view.contentHeight * density).toInt().coerceAtLeast(1)
                        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
                        view.layout(0, 0, width, height)
                        val pageW = 595; val pageH = 842; val margin = 34f
                        val scale = (pageW - 2 * margin) / width
                        val slice = ((pageH - 2 * margin) / scale).toInt() // view pixels that fit on one page
                        val doc = PdfDocument()
                        var y = 0
                        var n = 1
                        while (y < height) {
                            val page = doc.startPage(PdfDocument.PageInfo.Builder(pageW, pageH, n++).create())
                            val c = page.canvas
                            c.translate(margin, margin)
                            c.scale(scale, scale)
                            c.clipRect(0, 0, width, slice)
                            c.translate(0f, -y.toFloat())
                            view.draw(c)
                            doc.finishPage(page)
                            y += slice
                        }
                        val out = ByteArrayOutputStream()
                        doc.writeTo(out)
                        doc.close()
                        view.destroy()
                        cont.resume(out.toByteArray())
                    } catch (e: Exception) {
                        view.destroy()
                        cont.resumeWithException(e)
                    }
                }, 400)
            }
        }
        web.loadDataWithBaseURL("https://drivex.invoice/", html, "text/html", "utf-8", null)
        cont.invokeOnCancellation { Handler(Looper.getMainLooper()).post { web.destroy() } }
    }

    /** Saves to the phone's Downloads folder and returns a link other apps can open. */
    suspend fun saveToDownloads(context: Context, name: String, bytes: ByteArray, mime: String = "application/pdf"): Uri = withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("no downloads")
            context.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
            uri
        } else {
            // Android 8-9: the app's own Download folder, no storage permission needed
            val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)!!.apply { mkdirs() }
            val file = File(dir, name).apply { writeBytes(bytes) }
            FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        }
    }

    /** A temporary copy for showing the file in another app (the uploaded PDF invoice or a document). */
    suspend fun cache(context: Context, name: String, bytes: ByteArray): Uri = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
        val file = File(dir, name).apply { writeBytes(bytes) }
        FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    }

    /** Opens a file in the phone's viewer (a PDF app, the gallery). */
    fun open(context: Context, uri: Uri, mime: String = "application/pdf") {
        val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(view) } catch (e: Exception) {
            Toast.makeText(context, t("Saved to Downloads"), Toast.LENGTH_LONG).show()
        }
    }

    /** Opens a link: WhatsApp, the phone app, mail, or the browser. */
    fun openLink(context: Context, url: String) {
        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (e: Exception) { Toast.makeText(context, t("No app on this phone can open this link."), Toast.LENGTH_LONG).show() }
    }
}
