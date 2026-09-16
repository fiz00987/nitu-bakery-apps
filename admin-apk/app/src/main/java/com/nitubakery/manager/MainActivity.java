package com.nitubakery.manager;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

/**
 * Launcher: opens the live admin dashboard in a Chrome Custom Tab backed
 * by a warm CustomTabs session — i.e. the REAL Chrome engine. This matters
 * because web push for the admin app is delivered by Chrome even when the
 * app is fully closed; a plain WebView wrapper would break that.
 */
public class MainActivity extends Activity {

    private Uri mUri;
    private CustomTabsSession mSession;
    private boolean mLaunched = false;

    private final CustomTabsServiceConnection mConnection = new CustomTabsServiceConnection() {
        @Override
        public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
            mSession = client.newSession(null);
            launch();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) { mSession = null; }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        mUri = Uri.parse(getString(R.string.admin_url));

        String pkg = CustomTabsClient.getPackageName(this, null);
        if (pkg == null || !CustomTabsClient.bindCustomTabsService(this, pkg, mConnection)) {
            launch();   // no Chrome-like browser — try the plain path
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Tapping the app icon again simply re-opens / brings forward the tab.
        launch();
    }

    private void launch() {
        if (mLaunched) return;
        mLaunched = true;

        try {
            CustomTabsIntent.Builder b = (mSession != null)
                    ? new CustomTabsIntent.Builder(mSession)
                    : new CustomTabsIntent.Builder();
            b.setToolbarColor(Color.parseColor("#c2185b"))
             .setShowTitle(true)
             .build()
             .launchUrl(this, mUri);
        } catch (Exception e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, mUri));
            } catch (Exception ignored) {
                Toast.makeText(this, "কোনো ব্রাউজার পাওয়া যায়নি", Toast.LENGTH_LONG).show();
            }
        }
        finish();
    }
}