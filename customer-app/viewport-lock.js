/* Lock browser zoom for customers while leaving one-finger form scrolling native. */
(function () {
  'use strict';

  if (window.__NITU_CUSTOMER_VIEWPORT_LOCK__) return;
  window.__NITU_CUSTOMER_VIEWPORT_LOCK__ = '2026-10-17-customer-zoom-lock';
  var tapStart = null;
  var lastTap = null;

  function preventZoom(event) {
    if (event.cancelable) event.preventDefault();
  }

  // Safari can expose pinch zoom as gesture events even when the viewport
  // metadata says that the page is not user-scalable.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    window.addEventListener(type, preventZoom, { passive: false, capture: true });
  });

  // Cancel native multi-touch zoom; one-finger vertical scrolling stays native.
  window.addEventListener('touchstart', function (event) {
    if (event.touches.length > 1) {
      tapStart = lastTap = null;
      preventZoom(event);
    } else if (event.touches.length === 1) {
      var touch = event.touches[0];
      tapStart = { x: touch.clientX, y: touch.clientY, time: Date.now(), moved: false };
    }
  }, { passive: false, capture: true });

  window.addEventListener('touchmove', function (event) {
    if (event.touches.length > 1) {
      tapStart = lastTap = null;
      preventZoom(event);
    } else if (tapStart && event.touches.length === 1) {
      var touch = event.touches[0];
      if (Math.abs(touch.clientX - tapStart.x) > 10 || Math.abs(touch.clientY - tapStart.y) > 10) tapStart.moved = true;
    }
  }, { passive: false, capture: true });

  // Cancel mobile double-tap zoom. On the second tap, replay an actionable
  // button/link click once so normal customer interactions remain intact.
  window.addEventListener('touchend', function (event) {
    var started = tapStart;
    tapStart = null;
    if (!started || event.touches.length || !event.changedTouches.length) return;
    if (started.moved) {
      lastTap = null;
      return;
    }
    var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
    if (!target || !target.closest) return;
    // Keep native text selection available in editable fields.
    if (target.closest('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]')) {
      lastTap = null;
      return;
    }
    var touch = event.changedTouches[0];
    var now = Date.now();
    var repeated = lastTap && now - lastTap.time < 300 && now - started.time < 300 &&
      Math.abs(touch.clientX - lastTap.x) < 25 && Math.abs(touch.clientY - lastTap.y) < 25;
    if (repeated && event.cancelable) {
      preventZoom(event);
      lastTap = null;
      var action = target.closest('button, a, label, input[type="checkbox"], input[type="radio"], [onclick]');
      if (action && typeof action.click === 'function') action.click();
    } else {
      lastTap = { time: now, x: touch.clientX, y: touch.clientY };
    }
  }, { passive: false, capture: true });

  window.addEventListener('touchcancel', function () { tapStart = lastTap = null; }, { capture: true });

  // Stop desktop ctrl/cmd zoom too when the form is opened on a computer.
  window.addEventListener('wheel', function (event) {
    if (event.ctrlKey || event.metaKey) preventZoom(event);
  }, { passive: false, capture: true });

  window.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '_', '0'].includes(event.key)) {
      preventZoom(event);
    }
  }, { capture: true });

  window.addEventListener('dblclick', function (event) {
    if (window.matchMedia('(pointer: coarse)').matches) preventZoom(event);
  }, { capture: true });
})();
