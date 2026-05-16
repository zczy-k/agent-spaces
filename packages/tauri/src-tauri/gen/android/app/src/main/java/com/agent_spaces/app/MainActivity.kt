package com.agent_spaces.app

import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
    private var statusBarTheme = "light"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        statusBarTheme = if (isSystemDarkTheme()) "dark" else "light"
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        applyStatusBarTheme(statusBarTheme)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webView.addJavascriptInterface(StatusBarBridge(this), "AgentSpacesStatusBar")
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            dispatchNativeInsets(webView, insets)
            insets
        }
        ViewCompat.requestApplyInsets(webView)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        applyStatusBarTheme(statusBarTheme)
    }

    fun applyStatusBarTheme(theme: String) {
        val isDark = theme == "dark"
        statusBarTheme = if (isDark) "dark" else "light"
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = !isDark
        insetsController.isAppearanceLightNavigationBars = !isDark
    }

    private fun isSystemDarkTheme(): Boolean {
        return (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    private fun dispatchNativeInsets(webView: WebView, insets: WindowInsetsCompat) {
        val density = resources.displayMetrics.density
        val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
        val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
        val keyboardPx = if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
            maxOf(0, ime.bottom - systemBars.bottom)
        } else {
            0
        }
        val topDp = systemBars.top / density
        val keyboardDp = keyboardPx / density
        val script = """
            (function () {
              window.__agentSpacesNativeInsets = {
                top: $topDp,
                keyboard: $keyboardDp
              };
              window.dispatchEvent(new CustomEvent('agent-spaces-native-insets', {
                detail: window.__agentSpacesNativeInsets
              }));
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(script, null)
        }
    }

    class StatusBarBridge(private val activity: MainActivity) {
        @JavascriptInterface
        fun setTheme(theme: String) {
            activity.runOnUiThread {
                activity.applyStatusBarTheme(theme)
            }
        }

        @JavascriptInterface
        fun getTopInset(): Float {
            val resourceId = activity.resources.getIdentifier("status_bar_height", "dimen", "android")
            if (resourceId <= 0) return 0f

            val heightPx = activity.resources.getDimensionPixelSize(resourceId)
            return heightPx / activity.resources.displayMetrics.density
        }
    }
}
