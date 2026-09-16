package com.nitubakery.widget;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

/**
 * Minimal launcher screen: explains how to add the widget and offers a
 * manual refresh. The widget itself works without ever opening this.
 */
public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        final TextView status = findViewById(R.id.status);
        Button refresh = findViewById(R.id.refresh);
        refresh.setOnClickListener(v -> {
            status.setText("স্ট্যাটাস: রিফ্রেশ হচ্ছে…");
            WidgetProvider.refreshAll(this);
            status.postDelayed(() -> status.setText("স্ট্যাটাস: উইজেট আপডেট করা হয়েছে ✅"), 1200);
        });
    }
}