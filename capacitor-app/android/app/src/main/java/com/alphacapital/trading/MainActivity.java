package com.alphacapital.trading;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(0xFF070C18);
        }
    }

    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null) {
            WebView wv = bridge.getWebView();
            String currentUrl = wv.getUrl();
            if (currentUrl != null && currentUrl.contains("offline.html")) {
                wv.loadUrl("https://demo.launchapropfirm.com");
                return;
            }
            if (wv.canGoBack()) {
                wv.goBack();
                return;
            }
        }
        super.onBackPressed();
    }
}
