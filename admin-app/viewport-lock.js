/* Lock browser zoom throughout the admin app, including opened photos. */
(function () {
  'use strict';

  if (window.__NITU_VIEWPORT_LOCK__) return;
  window.__NITU_VIEWPORT_LOCK__ = '2026-10-11-delivery-agent-tab';
  var tapStart = null;
  var lastTap = null;

  function preventZoom(event) {
    if (event.cancelable) event.preventDefault();
  }

  // Safari exposes native pinch zoom as gesture events, including when it
  // disregards the viewport's user-scalable setting.
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

  // Mobile double-tap zoom can happen before a cancellable `dblclick` exists.
  // Cancel the second touch end, replaying a button/link click exactly once so
  // rapid calculator taps and other actions continue to work normally.
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
    var inLightbox = target.closest('#lightbox');
    if (inLightbox) {
      // The lightbox owns photo gestures and its controls' native clicks.
      // Native viewport zoom is already blocked by the lightbox touch-action,
      // gesture listeners, and viewport policy; never replay a control click.
      lastTap = null;
      return;
    }
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
