package com.drivex.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.provider.MediaStore
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import android.webkit.CookieManager
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File

/**
 * The Drivex customer app: the Drivex site (BuildConfig.START_URL) in a WebView, with what a browser tab cannot do
 * done natively: links to WhatsApp / phone / maps open their apps, other sites open in a Custom Tab, invoices and
 * documents are saved to Downloads, document photos can be taken with the camera, the back button goes back in the
 * page, and a clear screen is shown when there is no connection.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offline: View
    private val router = LinkRouter(BuildConfig.START_URL)
    private val appOrigin = Uri.parse(BuildConfig.START_URL).let { "${it.scheme}://${it.authority}" }
    private var firstPageShown = false
    private var bridgeScript: String? = null // set when the WebView cannot add it at document start: added after each load
    private var mainFrameFailed = false

    // file upload: the page's callback, and where a camera photo is written
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingChooser: WebChromeClient.FileChooserParams? = null
    private var cameraUri: Uri? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        val picked = when {
            result.resultCode != RESULT_OK -> null
            data?.clipData != null -> Array(data.clipData!!.itemCount) { data.clipData!!.getItemAt(it).uri }
            data?.data != null -> arrayOf(data.data!!)
            cameraUri != null && (contentResolver.openAssetFileDescriptor(cameraUri!!, "r")?.use { it.length > 0 } == true) -> arrayOf(cameraUri!!)
            else -> null
        }
        fileCallback?.onReceiveValue(picked) // null tells the page the choice was cancelled, so it can be tried again
        fileCallback = null
        cameraUri = null
    }

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        pendingChooser?.let { openChooser(it, withCamera = granted) }
        pendingChooser = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        // keep the Drivex splash until the first page has drawn (at most a few seconds), so there is no white flash
        splash.setKeepOnScreenCondition { !firstPageShown }
        window.decorView.postDelayed({ firstPageShown = true }, 4000)

        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)
        progress = findViewById(R.id.progress)
        offline = findViewById(R.id.offline)
        findViewById<Button>(R.id.retry).setOnClickListener { mainFrameFailed = false; offline.isVisible = false; web.reload() }

        // the page sits between the status bar and the navigation bar / keyboard; the bars show the page colour
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        setUpWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(linkFrom(intent) ?: BuildConfig.START_URL)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(web, true) } // Stripe 3-D Secure
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // the session and settings live in localStorage
            setSupportMultipleWindows(true) // window.open() is routed in onCreateWindow
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            textZoom = 100 // the page sizes its own text; the phone's font size setting must not break the layout
            userAgentString = "$userAgentString DrivexApp/${BuildConfig.VERSION_NAME} (Android)"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            androidx.webkit.WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false) // the page has its own colours
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                return open(request.url.toString(), fromPopup = false)
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                progress.isVisible = true
            }

            override fun onPageCommitVisible(view: WebView, url: String?) {
                firstPageShown = true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (url?.startsWith(appOrigin) == true) bridgeScript?.let { view.evaluateJavascript(it, null) }
                firstPageShown = true
                progress.isVisible = false
                if (!mainFrameFailed) offline.isVisible = false
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                mainFrameFailed = true
                firstPageShown = true
                offline.isVisible = true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.isVisible = newProgress < 100
            }

            // window.open(): the page sometimes opens an empty window first and sets its address later (so the
            // browser does not block it). A hidden WebView catches that address, and the router decides where it goes.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        open(request.url.toString(), fromPopup = true)
                        v.destroy()
                        return true
                    }
                }
                popup.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView) = window.destroy() // the page closed it (e.g. the file failed to load)
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }

            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val wantsImages = params.acceptTypes.any { it.isBlank() || it.startsWith("image") }
                val hasCamera = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
                when {
                    !wantsImages || !hasCamera -> openChooser(params, withCamera = false)
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED -> openChooser(params, withCamera = true)
                    else -> { pendingChooser = params; askCamera.launch(Manifest.permission.CAMERA) }
                }
                return true
            }
        }

        installDownloadBridge()
        web.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("http")) Downloads.fromUrl(this, url, null, userAgent, contentDisposition, mimeType)
        }
    }

    /** The page's download links (see assets/bridge.js) reach the app through a message channel open to the Drivex site only. */
    private fun installDownloadBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(web, "DrivexAndroid", setOf(appOrigin)) { _, message, _, isMainFrame, _ ->
            if (!isMainFrame) return@addWebMessageListener
            val msg = runCatching { JSONObject(message.data ?: "") }.getOrNull() ?: return@addWebMessageListener
            val name = msg.optString("name").ifBlank { null }
            when (msg.optString("type")) {
                "dataUrl" -> Downloads.fromDataUrl(this, msg.optString("data"), name)
                "url" -> msg.optString("url").takeIf { it.startsWith("https://") || it.startsWith("http://") }
                    ?.let { if (router.route(it) == Route.IN_APP) web.loadUrl(it) else Downloads.fromUrl(this, it, name, web.settings.userAgentString) }
                "failed" -> android.widget.Toast.makeText(this, R.string.download_failed, android.widget.Toast.LENGTH_SHORT).show()
            }
        }
        val script = assets.open("bridge.js").bufferedReader().use { it.readText() }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, setOf(appOrigin))
        } else {
            bridgeScript = script
        }
    }

    /** Handles a link the page opens. Returns true when the WebView must not load it itself. */
    private fun open(url: String, fromPopup: Boolean): Boolean = when (router.route(url)) {
        Route.IN_APP -> { if (fromPopup) web.loadUrl(url); false }
        Route.DOWNLOAD -> {
            // "View" opens a window (show the file); a direct link is a download
            if (fromPopup) openInTab(url) else Downloads.fromUrl(this, url, null, web.settings.userAgentString)
            true
        }
        Route.EXTERNAL_APP -> { openApp(url); true }
        Route.BROWSER_TAB -> { openInTab(url); true }
        Route.IGNORE -> true
    }

    private fun openApp(url: String) {
        val intent = if (url.startsWith("intent:")) {
            runCatching { Intent.parseUri(url, Intent.URI_INTENT_SCHEME).apply { selector = null; component = null } }.getOrNull()
        } else if (url.startsWith("tel:")) Intent(Intent.ACTION_DIAL, Uri.parse(url))
        else Intent(Intent.ACTION_VIEW, Uri.parse(url))
        try {
            intent?.addCategory(Intent.CATEGORY_BROWSABLE)?.let { startActivity(it) }
        } catch (_: ActivityNotFoundException) {
            // no app for it: an intent: link may name a web fallback; a web link can still open in a tab
            val fallback = intent?.getStringExtra("browser_fallback_url") ?: url.takeIf { it.startsWith("http") }
            if (fallback != null) openInTab(fallback)
            else android.widget.Toast.makeText(this, R.string.no_app, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun openInTab(url: String) {
        val colours = CustomTabColorSchemeParams.Builder().setToolbarColor(getColor(R.color.page)).build()
        try {
            CustomTabsIntent.Builder().setDefaultColorSchemeParams(colours).setShowTitle(true).build().launchUrl(this, Uri.parse(url))
        } catch (_: ActivityNotFoundException) {
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }
    }

    private fun openChooser(params: WebChromeClient.FileChooserParams, withCamera: Boolean) {
        val pick = params.createIntent().apply {
            if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        val camera = if (withCamera) {
            val file = File(File(cacheDir, "camera").apply { mkdirs() }, "photo-${System.currentTimeMillis()}.jpg")
            cameraUri = FileProvider.getUriForFile(this, "$packageName.files", file)
            Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } else null
        val chooser = Intent.createChooser(pick, getString(R.string.choose_file)).apply {
            if (camera != null) putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))
        }
        try {
            pickFiles.launch(chooser)
        } catch (_: ActivityNotFoundException) {
            fileCallback?.onReceiveValue(null)
            fileCallback = null
        }
    }

    /** A link to the Drivex site that opened the app (from WhatsApp, an email, a notification). */
    private fun linkFrom(intent: Intent?): String? =
        intent?.takeIf { it.action == Intent.ACTION_VIEW }?.dataString?.takeIf { it == appOrigin || it.startsWith("$appOrigin/") } // only Drivex pages, not a payment host

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        linkFrom(intent)?.let { web.loadUrl(it) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush() // keep the session if Android closes the app
        super.onPause()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        web.destroy()
        super.onDestroy()
    }
}
