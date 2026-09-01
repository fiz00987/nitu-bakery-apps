// ============================================================
// 🎂 নিতুর বেকারি — Home-screen widget (iOS, via Scriptable)
// ============================================================
// HOW TO USE (one time, ~2 minutes):
//   1. Install "Scriptable" (free) from the App Store.
//   2. Open Scriptable → + (new script) → paste this ENTIRE file.
//   3. Tap ▶ once to test — you should see today's orders.
//   4. Go to the Home Screen → long-press an empty area → + →
//      search "Scriptable" → pick a Medium or Large widget.
//   5. Tap the widget → Script → choose this script. Done.
//      (Widgets refresh automatically every ~5–15 minutes.)
// ============================================================

const FEED_URL =
  'https://nitusbakingplanv2-default-rtdb.asia-southeast1.firebasedatabase.app/widgetFeed.json';

const PINK  = new Color('#c2185b');
const GREY  = new Color(Device.isUsingDarkAppearance() ? '#bbbbbb' : '#666666');
const GREEN = new Color('#2e7d32');
const RED   = new Color('#d32f2f');

const taka = n => '৳' + Math.round(Number(n) || 0).toLocaleString('bn-BD');

const widget = new ListWidget();
widget.backgroundColor = new Color(Device.isUsingDarkAppearance() ? '#000000' : '#ffffff');
widget.setPadding(12, 14, 12, 14);

try {
  const feed = await new Request(FEED_URL).loadJSON();

  if (!feed || !feed.today) throw new Error('feed empty');

  // ── Header: today's deliveries ──
  const title = widget.addText('🎂 আজকের ডেলিভারি: ' + (feed.today.count || 0));
  title.font = Font.boldSystemFont(15);
  title.textColor = PINK;

  if (feed.today.names && feed.today.names.length) {
    const names = widget.addText(feed.today.names.slice(0, 4).join(' · '));
    names.font = Font.systemFont(11);
    names.textColor = GREY;
    names.lineLimit = 2;
  } else {
    const none = widget.addText('আজ কোনো ডেলিভারি নেই');
    none.font = Font.systemFont(11);
    none.textColor = GREY;
  }
  widget.addSpacer(6);

  // ── Latest orders (up to 5) ──
  const latest = (feed.latest || []).slice(0, widget.family === WidgetFamily.large ? 5 : 3);
  for (const o of latest) {
    const row = widget.addStack();
    row.centerAlignContent();
    const dot = row.addText(o.st === 'delivered' ? '✅' : '🔵');
    dot.font = Font.systemFont(10);
    row.addSpacer(4);
    const left = row.addStack();
    left.layoutVertically();
    const name = left.addText((o.n || '—').slice(0, 22) + '  ·  ' + taka(o.t));
    name.font = Font.semiboldSystemFont(12);
    name.textColor = new Color(Device.isUsingDarkAppearance() ? '#eeeeee' : '#222222');
    const meta = left.addText(
      `${o.i || ''}`.slice(0, 34) + (o.dt ? `  ·  ${o.dt}` : '') + (o.tm ? ` ${o.tm}` : '')
    );
    meta.font = Font.systemFont(9);
    meta.textColor = GREY;
    meta.lineLimit = 1;
    if (Number(o.d) > 0) {
      row.addSpacer(4);
      const due = row.addText('বাকি ' + taka(o.d));
      due.font = Font.systemFont(10);
      due.textColor = RED;
    } else {
      row.addSpacer(4);
      const paid = row.addText('পরিশোধিত');
      paid.font = Font.systemFont(10);
      paid.textColor = GREEN;
    }
    widget.addSpacer(3);
  }

  widget.addSpacer();
  const when = widget.addText('আপডেট: ' + new Date(feed.updatedAt || Date.now())
    .toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }));
  when.font = Font.systemFont(8);
  when.textColor = GREY;
  when.rightAlignText();
} catch (err) {
  widget.addText('⚠️ অর্ডার লোড করা যায়নি').font = Font.semiboldSystemFont(13);
  widget.addText(String(err)).font = Font.systemFont(9);
  widget.addText('ইন্টারনেট চেক করে আবার চেষ্টা করুন').font = Font.systemFont(9);
}

Script.setWidget(widget);
Script.complete();