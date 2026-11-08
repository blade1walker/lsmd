package com.nexus.ems;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;

    private ValueCallback<Uri[]> mUploadMessage;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    private long backPressedTime = 0;
    private boolean isTablet = false;

    // The live production URL of the Nexus EMS website
    private String serverUrl = "https://lsmd.tech";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Switch back to main theme from splash
        setTheme(R.style.Theme_NexusEMS);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        isTablet = getResources().getBoolean(R.bool.is_tablet);
        serverUrl = getString(R.string.server_url);

        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // Styling swipe refresh loader
        swipeRefreshLayout.setColorSchemeColors(
            getResources().getColor(R.color.primary),
            getResources().getColor(R.color.accent)
        );
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(
            getResources().getColor(R.color.surface)
        );
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (isNetworkAvailable()) {
                webView.reload();
            } else {
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(this, R.string.offline_title, Toast.LENGTH_SHORT).show();
            }
        });

        setupFileChooser();
        setupWebView();
        setupBackNavigation();

        if (savedInstanceState == null) {
            loadInitialUrl();
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void setupFileChooser() {
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (mUploadMessage == null) return;
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    if (result.getData().getClipData() != null) {
                        int count = result.getData().getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = result.getData().getClipData().getItemAt(i).getUri();
                        }
                    } else if (result.getData().getData() != null) {
                        results = new Uri[]{result.getData().getData()};
                    }
                }
                mUploadMessage.onReceiveValue(results);
                mUploadMessage = null;
            }
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Tablet & Desktop viewport simulation if needed
        if (isTablet) {
            settings.setUserAgentString(settings.getUserAgentString() + " NexusEMS-Tablet/1.0");
        } else {
            settings.setUserAgentString(settings.getUserAgentString() + " NexusEMS-Mobile/1.0");
        }

        // Cache settings for snappy performance
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Cookie management for NextAuth sessions
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Native JS Bridge
        webView.addJavascriptInterface(new WebAppInterface(this, isTablet), "NexusAndroid");

        webView.setWebViewClient(new CustomWebViewClient());
        webView.setWebChromeClient(new CustomWebChromeClient());
    }

    private void loadInitialUrl() {
        if (isNetworkAvailable()) {
            webView.loadUrl(serverUrl);
        } else {
            webView.loadUrl(OFFLINE_URL);
        }
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, R.string.exit_prompt, Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
        }
        return false;
    }

    private boolean isInternalHost(String host) {
        if (host == null) return false;
        try {
            Uri configuredUri = Uri.parse(serverUrl);
            String configuredHost = configuredUri.getHost();
            if (configuredHost != null && (host.equalsIgnoreCase(configuredHost) || host.toLowerCase().endsWith("." + configuredHost.toLowerCase()))) {
                return true;
            }
        } catch (Exception ignored) {}

        return host.equals("lsmd.tech") || host.endsWith(".lsmd.tech")
            || host.equals("localhost") || host.equals("127.0.0.1") || host.equals("10.0.2.2");
    }

    /**
     * Discord's sign-in pages. "Sign in with Discord" must finish in this
     * WebView: the site's OAuth state cookie lives in the WebView's cookie jar,
     * so a callback that lands in Chrome or the Discord app fails, and even a
     * successful one would sign in the browser, not the app.
     */
    private boolean isDiscordSignIn(Uri uri) {
        String host = uri.getHost();
        String path = uri.getPath();
        if (host == null || path == null) return false;
        host = host.toLowerCase();
        boolean discord = host.equals("discord.com") || host.endsWith(".discord.com")
            || host.equals("discordapp.com") || host.endsWith(".discordapp.com");
        return discord && (path.startsWith("/oauth2") || path.startsWith("/api/oauth2")
            || path.startsWith("/login") || path.startsWith("/register"));
    }

    private class CustomWebViewClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            swipeRefreshLayout.setRefreshing(false);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                webView.loadUrl(OFFLINE_URL);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String host = uri.getHost();

            // Keep internal app navigation within WebView
            if (host != null && isInternalHost(host)) {
                return false;
            }
            if (isDiscordSignIn(uri)) {
                return false;
            }

            // Open external URLs (Discord, FiveM, docs) in default Android browser or native apps
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private class CustomWebChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            if (newProgress < 100) {
                progressBar.setProgress(newProgress);
            } else {
                progressBar.setVisibility(View.GONE);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            if (mUploadMessage != null) {
                mUploadMessage.onReceiveValue(null);
            }
            mUploadMessage = filePathCallback;

            Intent intent = fileChooserParams.createIntent();
            try {
                fileChooserLauncher.launch(intent);
            } catch (Exception e) {
                mUploadMessage = null;
                return false;
            }
            return true;
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Seamless orientation change handling on tablets & foldables
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }
}
