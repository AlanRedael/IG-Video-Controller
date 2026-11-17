/*
 * IG Video Controller — content script.
 * Only controls playback of <video> elements on www.instagram.com.
 * Does not read page content, use the network or store anything.
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Single instance
  // ---------------------------------------------------------------------------
  if (globalThis.__igvcLoaded) return;
  globalThis.__igvcLoaded = true;

  // ---------------------------------------------------------------------------
  // 2. Constants (the only values that can become a playback rate)
  // ---------------------------------------------------------------------------
  const PRESETS = Object.freeze({ r: 1, g: 1.5, h: 2 });
  const STEP = 0.25;
  const SEEK = 5;
  const MIN_RATE = 0.25;
  const MAX_RATE = 4;
  const HIDE_DELAY_MS = 2000;
  const OVERLAY_TAG = "igvc-overlay-host";
  const OVERLAY_BUTTONS = Object.freeze([
    Object.freeze({ key: "r", label: "1x" }),
    Object.freeze({ key: "g", label: "1,5x" }),
    Object.freeze({ key: "h", label: "2x" }),
  ]);

  // Keyboard actions: key (lowercase) -> function with no external arguments.
  const ACTIONS = Object.freeze({
    r: () => setRate(PRESETS.r),
    g: () => setRate(PRESETS.g),
    h: () => setRate(PRESETS.h),
    s: () => setRate(desiredRate - STEP),
    d: () => setRate(desiredRate + STEP),
    z: () => seekBy(-SEEK),
    x: () => seekBy(SEEK),
    v: () => togglePlay(),
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let desiredRate = PRESETS.r;
  const controlled = new WeakSet(); // videos that already have listeners
  const observed = new Set(); // videos watched by the IntersectionObserver
  const visibility = new WeakMap(); // video -> intersectionRatio

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visibility.set(entry.target, entry.intersectionRatio);
      }
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );

  // ---------------------------------------------------------------------------
  // Rate helpers
  // ---------------------------------------------------------------------------
  function clampRate(rate) {
    if (!Number.isFinite(rate)) return null;
    const clamped = Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
    // Round to hundredths to avoid floating-point noise.
    return Math.round(clamped * 100) / 100;
  }

  function applyRate(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    try {
      // Compare before assigning so "ratechange" does not loop.
      if (video.defaultPlaybackRate !== desiredRate) {
        video.defaultPlaybackRate = desiredRate;
      }
      if (video.playbackRate !== desiredRate) {
        video.playbackRate = desiredRate;
      }
    } catch (_) {
      // Some media states reject the assignment; ignore silently.
    }
  }

  function setRate(rate) {
    const next = clampRate(rate);
    if (next === null) return;
    desiredRate = next;
    const video = getActiveVideo();
    if (video) applyRate(video);
    updateOverlayLabel();
    showOverlay();
  }

  function formatRate(rate) {
    return String(rate).replace(".", ",") + "x";
  }

  // ---------------------------------------------------------------------------
  // Active video
  // ---------------------------------------------------------------------------
  function isPlaying(video) {
    return !video.paused && !video.ended && video.readyState > 2;
  }

  function getActiveVideo() {
    const videos = document.querySelectorAll("video");
    let bestPlaying = null;
    let bestPlayingRatio = -1;
    let bestVisible = null;
    let bestVisibleRatio = 0;
    let anyPlaying = null;

    for (const video of videos) {
      const ratio = visibility.get(video) || 0;
      if (isPlaying(video)) {
        if (!anyPlaying) anyPlaying = video;
        // An off-screen playing video must not steal focus from the visible one.
        if (ratio > 0 && ratio > bestPlayingRatio) {
          bestPlaying = video;
          bestPlayingRatio = ratio;
        }
      }
      if (ratio > bestVisibleRatio) {
        bestVisible = video;
        bestVisibleRatio = ratio;
      }
    }
    return bestPlaying || bestVisible || anyPlaying;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function seekBy(seconds) {
    if (!Number.isFinite(seconds)) return;
    const video = getActiveVideo();
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const target = Math.min(duration, Math.max(0, video.currentTime + seconds));
    if (Number.isFinite(target)) video.currentTime = target;
    showOverlay();
  }

  function togglePlay() {
    const video = getActiveVideo();
    if (!video) return;
    if (video.paused || video.ended) {
      const result = video.play();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } else {
      video.pause();
    }
    showOverlay();
  }

  // ---------------------------------------------------------------------------
  // Video registration
  // ---------------------------------------------------------------------------
  function attach(video) {
    if (!observed.has(video)) {
      observed.add(video);
      io.observe(video);
    }
    if (controlled.has(video)) return;
    controlled.add(video);

    const reapply = () => applyRate(video);
    video.addEventListener("ratechange", reapply);
    video.addEventListener("play", reapply);
    video.addEventListener("playing", reapply);
    video.addEventListener("loadedmetadata", reapply);
    // When the active video pauses, show the overlay (it stays visible while paused).
    video.addEventListener("pause", () => {
      if (video === getActiveVideo()) showOverlay();
    });
    applyRate(video);
  }

  function scan() {
    // Stop observing videos that left the DOM.
    for (const video of observed) {
      if (!video.isConnected) {
        io.unobserve(video);
        observed.delete(video);
        visibility.delete(video);
      }
    }
    for (const video of document.querySelectorAll("video")) {
      attach(video);
    }
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scan();
    });
  }

  // ---------------------------------------------------------------------------
  // Overlay (single, closed Shadow DOM) — bottom edge of the video
  // ---------------------------------------------------------------------------
  // Remove an orphaned host from a previous injection, if any.
  for (const stale of document.querySelectorAll(OVERLAY_TAG)) stale.remove();

  const host = document.createElement(OVERLAY_TAG);
  host.style.cssText =
    "all:initial;position:fixed;top:0;left:0;width:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    .wrap {
      box-sizing: border-box;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 18px 10px 4px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
      color: #fff;
      font: 600 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.2s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    .wrap.hidden {
      opacity: 0;
      visibility: hidden;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .rate {
      min-width: 3.2em;
      text-align: center;
    }
    .time {
      margin-right: 4px;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    button {
      pointer-events: auto;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font: inherit;
      padding: 2px 6px;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.28);
    }
    button[aria-pressed="true"] {
      background: #fff;
      color: #000;
    }
    /* Bar hit area: taller than the visible line. */
    .seek {
      position: relative;
      height: 14px;
      pointer-events: auto;
      cursor: pointer;
      touch-action: none;
    }
    .seek.disabled {
      pointer-events: none;
      opacity: 0.5;
    }
    .track,
    .fill {
      position: absolute;
      left: 0;
      top: 50%;
      height: 3px;
      border-radius: 2px;
      transform: translateY(-50%);
      transition: height 0.12s ease;
    }
    .track {
      right: 0;
      background: rgba(255, 255, 255, 0.3);
    }
    .fill {
      width: 0;
      background: #fff;
    }
    .thumb {
      position: absolute;
      top: 50%;
      left: 0;
      width: 12px;
      height: 12px;
      margin-left: -6px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
      transform: translateY(-50%) scale(0);
      transition: transform 0.12s ease;
    }
    .seek:hover .track,
    .seek:hover .fill,
    .seek.dragging .track,
    .seek.dragging .fill {
      height: 5px;
    }
    .seek:hover .thumb,
    .seek.dragging .thumb {
      transform: translateY(-50%) scale(1);
    }
  `;

  const wrap = document.createElement("div");
  wrap.className = "wrap hidden";

  // Controls row: time, rate and presets (all on the left, so they do not
  // cover Instagram's volume button in the right corner).
  const row = document.createElement("div");
  row.className = "row";

  const timeLabel = document.createElement("span");
  timeLabel.className = "time";
  row.appendChild(timeLabel);

  const rateLabel = document.createElement("span");
  rateLabel.className = "rate";
  rateLabel.textContent = formatRate(desiredRate);
  row.appendChild(rateLabel);

  let hoveringControls = false;
  const enterControls = () => {
    hoveringControls = true;
    cancelHide();
  };
  const leaveControls = () => {
    hoveringControls = false;
    scheduleHide();
  };
  const stop = (event) => event.stopPropagation();

  const presetButtons = [];
  for (const def of OVERLAY_BUTTONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = def.label;
    const presetRate = PRESETS[def.key];
    button.addEventListener("pointerdown", stop);
    button.addEventListener("pointerup", stop);
    button.addEventListener("mousedown", stop);
    button.addEventListener("mouseup", stop);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      setRate(presetRate);
    });
    button.addEventListener("pointerenter", enterControls);
    button.addEventListener("pointerleave", leaveControls);
    presetButtons.push({ button, rate: presetRate });
    row.appendChild(button);
  }

  // Interactive progress bar.
  const seek = document.createElement("div");
  seek.className = "seek";
  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = "fill";
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  seek.appendChild(track);
  seek.appendChild(fill);
  seek.appendChild(thumb);

  wrap.appendChild(row);
  wrap.appendChild(seek);
  shadow.appendChild(style);
  shadow.appendChild(wrap);
  document.documentElement.appendChild(host);

  let hideTimer = 0;
  let overlayVisible = false;
  let positionLoop = 0;
  let dragVideo = null; // video being scrubbed (fixed for the whole drag)
  let dragPointer = null;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
  }

  function updateOverlayLabel() {
    rateLabel.textContent = formatRate(desiredRate);
    for (const { button, rate } of presetButtons) {
      button.setAttribute("aria-pressed", rate === desiredRate ? "true" : "false");
    }
  }

  function updateProgress(video) {
    const duration = video.duration;
    const seekable = Number.isFinite(duration) && duration > 0;
    const ratio = seekable ? Math.min(1, Math.max(0, video.currentTime / duration)) : 0;
    const pct = `${(ratio * 100).toFixed(3)}%`;
    fill.style.width = pct;
    thumb.style.left = pct;
    seek.classList[seekable ? "remove" : "add"]("disabled");
    timeLabel.textContent = seekable
      ? `${formatTime(video.currentTime)} / ${formatTime(duration)}`
      : formatTime(video.currentTime);
  }

  function positionOverlay() {
    const video = dragVideo || getActiveVideo();
    if (!video || !video.isConnected) {
      hideOverlay();
      return;
    }
    const rect = video.getBoundingClientRect();
    const viewH = document.documentElement.clientHeight;
    const viewW = document.documentElement.clientWidth;
    const left = Math.max(0, rect.left);
    const right = Math.min(viewW, rect.right);
    const bottom = Math.min(viewH, rect.bottom);
    const width = Math.max(0, right - left);
    host.style.width = `${Math.round(width)}px`;
    const height = wrap.offsetHeight || 0;
    host.style.transform = `translate(${Math.round(left)}px, ${Math.round(bottom - height)}px)`;
    updateProgress(video);
  }

  function tick() {
    if (!overlayVisible) {
      positionLoop = 0;
      return;
    }
    positionOverlay();
    positionLoop = requestAnimationFrame(tick);
  }

  function showOverlay() {
    if (!host.isConnected) document.documentElement.appendChild(host);
    overlayVisible = true;
    wrap.classList.remove("hidden");
    if (!positionLoop) positionLoop = requestAnimationFrame(tick);
    scheduleHide();
  }

  // Stay visible while the video is paused, during a drag or while the pointer
  // is over the controls.
  function shouldStayVisible() {
    if (dragVideo || hoveringControls) return true;
    const video = getActiveVideo();
    return Boolean(video && video.paused);
  }

  function hideOverlay() {
    cancelHide();
    if (overlayVisible && shouldStayVisible() && getActiveVideo()) {
      scheduleHide();
      return;
    }
    overlayVisible = false;
    wrap.classList.add("hidden");
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideOverlay, HIDE_DELAY_MS);
  }

  // --- Progress bar dragging ---
  function seekToPointer(clientX) {
    const video = dragVideo;
    if (!video || !Number.isFinite(clientX)) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const rect = seek.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    updateProgress(video);
  }

  function endDrag(event) {
    if (event) event.stopPropagation();
    if (dragPointer !== null && seek.hasPointerCapture(dragPointer)) {
      seek.releasePointerCapture(dragPointer);
    }
    dragPointer = null;
    dragVideo = null;
    seek.classList.remove("dragging");
    scheduleHide();
  }

  seek.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.button !== 0) return;
    const video = getActiveVideo();
    if (!video) return;
    dragVideo = video;
    dragPointer = event.pointerId;
    seek.setPointerCapture(event.pointerId);
    seek.classList.add("dragging");
    cancelHide();
    seekToPointer(event.clientX);
  });
  seek.addEventListener("pointermove", (event) => {
    if (dragPointer !== event.pointerId) return;
    event.stopPropagation();
    seekToPointer(event.clientX);
  });
  seek.addEventListener("pointerup", endDrag);
  seek.addEventListener("pointercancel", endDrag);
  seek.addEventListener("lostpointercapture", () => {
    if (dragVideo) endDrag();
  });
  seek.addEventListener("mousedown", stop);
  seek.addEventListener("mouseup", stop);
  seek.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
  });
  seek.addEventListener("pointerenter", enterControls);
  seek.addEventListener("pointerleave", leaveControls);

  updateOverlayLabel();

  // Reappear when the pointer is over the active video (compares coordinates only).
  let pointerScheduled = false;
  let lastX = 0;
  let lastY = 0;
  document.addEventListener(
    "pointermove",
    (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (pointerScheduled) return;
      pointerScheduled = true;
      requestAnimationFrame(() => {
        pointerScheduled = false;
        const video = getActiveVideo();
        if (!video) return;
        const rect = video.getBoundingClientRect();
        if (lastX >= rect.left && lastX <= rect.right && lastY >= rect.top && lastY <= rect.bottom) {
          showOverlay();
        }
      });
    },
    { capture: true, passive: true }
  );

  // ---------------------------------------------------------------------------
  // 3. Keyboard (a single listener, capture phase)
  // ---------------------------------------------------------------------------
  function isEditable(node) {
    if (!(node instanceof Element)) return false;
    if (node.isContentEditable) return true;
    const tag = node.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (isEditable(path[0]) || isEditable(event.target) || isEditable(document.activeElement)) {
        return;
      }
      if (typeof event.key !== "string" || event.key.length !== 1) return;
      const key = event.key.toLowerCase();
      if (!Object.hasOwn(ACTIONS, key)) return;
      event.preventDefault();
      ACTIONS[key]();
    },
    true
  );

  // ---------------------------------------------------------------------------
  // DOM observation (a single debounced MutationObserver)
  // ---------------------------------------------------------------------------
  const root = document.body || document.documentElement;
  const mo = new MutationObserver(scheduleScan);
  mo.observe(root, { childList: true, subtree: true });

  scan();
})();
