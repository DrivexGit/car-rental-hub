package com.drivex.app

import android.app.Application
import com.drivex.app.core.Auth
import com.drivex.app.core.I18n
import com.drivex.app.core.ThemeStore

class DrivexApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // invoices are drawn from a web view into a PDF, which needs the whole page drawn, not only the visible part
        android.webkit.WebView.enableSlowWholeDocumentDraw()
        I18n.init(this)
        ThemeStore.init(this)
        Auth.init(this)
    }
}
