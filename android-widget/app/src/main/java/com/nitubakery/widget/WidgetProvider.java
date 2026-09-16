package com.nitubakery.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The home-screen widget. Reads the tiny /widgetFeed.json summary that the
 * admin app and the GitHub notifier keep updated, and renders:
 *   🎂 আজকের ডেলিভারি: N  + names + the latest orders (name, total, due/paid).
 *
 * Privacy: the feed contains ONLY names/items/amounts/dates/status.
 *
 * Refresh triggers:
 *   - every 30 minutes (system-scheduled, updatePeriodMillis)
 *   - whenever a widget is added or the app updates
 *   - tapping the ⟳ button on the widget
 *   - "এখনই রিফ্রেশ করুন" in the app
 */
public class WidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "com.nitubakery.widget.REFRESH";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static final int[] ROW_ROOT = {0, R.id.row1, R.id.row2, R.id.row3, R.id.row4};
    private static final int[] ROW_TITLE = {0, R.id.row1_t, R.id.row2_t, R.id.row3_t, R.id.row4_t};
    private static final int[] ROW_META = {0, R.id.row1_m, R.id.row2_m, R.id.row3_m, R.id.row4_m};

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) refresh(context, mgr, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refreshAll(context);
    }

    /** Refresh every widget currently on the home screen. */
    static void refreshAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, WidgetProvider.class));
        for (int id : ids) refresh(context, mgr, id);
    }

    static void refresh(final Context context, final AppWidgetManager mgr, final int appWidgetId) {
        showStatus(context, mgr, appWidgetId, "লোড হচ্ছে…");
        new Thread(new Runnable() {
            @Override public void run() {
                final String json = httpGet(context.getString(R.string.feed_url));
                MAIN.post(new Runnable() {
                    @Override public void run() { render(context, mgr, appWidgetId, json); }
                });
            }
        }).start();
    }

    private static void showStatus(Context context, AppWidgetManager mgr, int id, String status) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_layout);
        v.setTextViewText(R.id.names, status);
        wireTapActions(context, v);
        mgr.updateAppWidget(id, v);
    }

    private static void render(Context context, AppWidgetManager mgr, int id, String json) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

        if (json == null) {
            v.setTextViewText(R.id.names, "⚠️ লোড করা যায়নি — ইন্টারনেট চেক করুন");
            v.setTextViewText(R.id.updated, "ট্যাপ করে আবার চেষ্টা করুন");
            wireTapActions(context, v);
            mgr.updateAppWidget(id, v);
            return;
        }

        try {
            JSONObject feed = new JSONObject(json);
            JSONObject today = feed.optJSONObject("today");
            int count = today != null ? today.optInt("count", 0) : 0;
            v.setTextViewText(R.id.title, "🎂 আজকের ডেলিভারি: " + bn(count));

            JSONArray names = today != null ? today.optJSONArray("names") : null;
            StringBuilder nb = new StringBuilder();
            if (names != null) {
                for (int i = 0; i < names.length() && i < 4; i++) {
                    if (i > 0) nb.append(" · ");
                    nb.append(names.optString(i, "—"));
                }
            }
            v.setTextViewText(R.id.names,
                    nb.length() > 0 ? nb.toString() : "আজ কোনো ডেলিভারি নেই");

            JSONArray latest = feed.optJSONArray("latest");
            int rows = latest == null ? 0 : Math.min(latest.length(), 4);
            for (int i = 1; i <= 4; i++) {
                if (i <= rows) {
                    JSONObject o = latest.getJSONObject(i - 1);
                    long due = o.optLong("d", 0);

                    v.setViewVisibility(ROW_ROOT[i], android.view.View.VISIBLE);
                    v.setTextViewText(ROW_TITLE[i],
                            bnDigits(o.optString("n", "—")) + "  ·  " + taka(o.optLong("t", 0)));

                    StringBuilder meta = new StringBuilder(o.optString("i", ""));
                    String dt = o.optString("dt", "");
                    if (dt.length() > 0) meta.append(dt.equals(todayBd()) ? " · আজ" : " · " + dt);
                    String tm = o.optString("tm", "");
                    if (tm.length() > 0) meta.append(" · ").append(tm);
                    if (due > 0) meta.append(" · ⚠️ বাকি ").append(taka(due));
                    else meta.append(" · ✅ পরিশোধিত");
                    v.setTextViewText(ROW_META[i], meta.toString());
                    v.setTextColor(ROW_META[i], due > 0
                            ? Color.parseColor("#d32f2f")
                            : Color.parseColor("#2e7d32"));
                } else {
                    v.setViewVisibility(ROW_ROOT[i], android.view.View.GONE);
                }
            }

            String updated = new SimpleDateFormat("hh:mm a", Locale.US)
                    .format(new Date(feed.optLong("updatedAt", System.currentTimeMillis())));
            v.setTextViewText(R.id.updated, "আপডেট " + updated + " · ট্যাপ ⟳ রিফ্রেশ");

        } catch (Exception e) {
            v.setTextViewText(R.id.names, "⚠️ ডেটা পড়া যায়নি");
            v.setTextViewText(R.id.updated, "ট্যাপ করে আবার চেষ্টা করুন");
        }

        wireTapActions(context, v);
        mgr.updateAppWidget(id, v);
    }

    private static void wireTapActions(Context context, RemoteViews v) {
        // ⟳ button -> refresh broadcast
        Intent refresh = new Intent(context, WidgetProvider.class);
        refresh.setAction(ACTION_REFRESH);
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.refresh_btn, pi);

        // Whole widget -> open the admin app
        Intent open = new Intent(Intent.ACTION_VIEW,
                Uri.parse(context.getString(R.string.admin_url)));
        PendingIntent pOpen = PendingIntent.getActivity(context, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pOpen);
    }

    private static String httpGet(String urlStr) {
        HttpURLConnection c = null;
        try {
            URL url = new URL(urlStr);
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestMethod("GET");
            if (c.getResponseCode() != 200) return null;
            BufferedReader r = new BufferedReader(
                    new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) b.append(line);
            r.close();
            return b.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String todayBd() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US)
                .format(new Date(System.currentTimeMillis() + 6L * 3600 * 1000));
    }

    private static String taka(long n) {
        return "৳" + bn(n);
    }

    /** Convert ASCII digits to Bengali digits for a native look. */
    private static String bn(long n) {
        return bnDigits(String.valueOf(n));
    }

    private static String bnDigits(String s) {
        String[] bn = {"০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"};
        StringBuilder out = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            if (ch >= '0' && ch <= '9') out.append(bn[ch - '0']);
            else out.append(ch);
        }
        return out.toString();
    }
}