package com.recoral.app;

import android.os.Bundle;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // env(safe-area-inset-*) is not reliably populated inside Android's
        // WebView (a well-known Capacitor/Ionic limitation, this is the same
        // workaround Ionic's own framework uses for it: measure the real
        // inset natively and expose it as a CSS variable instead of trusting
        // the browser engine to report it).
        float density = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
            int topPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int bottomPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            int topDp = Math.round(topPx / density);
            int bottomDp = Math.round(bottomPx / density);
            getBridge()
                .getWebView()
                .evaluateJavascript(
                    "document.documentElement.style.setProperty('--android-status-top-inset','"
                        + topDp
                        + "px');"
                        + "document.documentElement.style.setProperty('--android-nav-bottom-inset','"
                        + bottomDp
                        + "px')",
                    null
                );
            return insets;
        });
    }
}
