# Progress — IG Video Controller

English version of [PROGRESSO.md](PROGRESSO.md).

Date: 2026-11-17

## Step 1 — Manifest and skeleton ✅
- `manifest.json` created exactly from the specified base. JSON validated.
- Icons `icons/16.png`, `48.png` and `128.png` generated locally with a Python script that uses only the standard library (`zlib` + `struct`): a magenta rounded square with a white antialiased "▶" triangle. No image was downloaded. The generator was kept out of the project because it is not part of the delivery structure.

## Step 2 — Controller core ✅
- IIFE with a `globalThis.__igvcLoaded` guard.
- Frozen constants: `PRESETS`, `ACTIONS` and `OVERLAY_BUTTONS` with `Object.freeze`; `STEP`, `SEEK`, `MIN_RATE` and `MAX_RATE` as `const`.
- `setRate` validates with `Number.isFinite`, clamps to [0.25, 4] and rounds to hundredths.
- `getActiveVideo`: prefers the most visible playing video; if none is playing, uses the most visible one. Uses **one** `IntersectionObserver`.
- `attach`: a `WeakSet` ensures listeners are added only once (`ratechange`, `play`, `playing`, `loadedmetadata`). All of them reapply `desiredRate`, comparing before assigning to avoid loops.
- **One** `MutationObserver` on `document.body` (`childList` + `subtree`), debounced with `requestAnimationFrame`.

**Decisions:**
- `defaultPlaybackRate` is also set, because a new `src`/`load()` resets `playbackRate` to that value. This helps keep the speed across Reels.
- Besides the `WeakSet`, an auxiliary `Set` is used only to remove videos that left the DOM from the `IntersectionObserver` and avoid memory leaks. Listeners are still controlled exclusively by the `WeakSet`.
- Extra `playing` and `loadedmetadata` listeners (besides `play`) cover the case where Instagram swaps the media without firing `ratechange`.

## Step 3 — Keyboard shortcuts ✅
- A single capture-phase `keydown` listener on `document`.
- Ignores the event when `Ctrl`/`Meta`/`Alt` is held, during IME composition (`isComposing`) and when the target is an `input`, `textarea`, `select` or `contenteditable` element. The target is checked on `composedPath()[0]`, `event.target` and `document.activeElement`.
- The map is checked with `Object.hasOwn`; `preventDefault()` only for handled keys.

## Step 4 — Overlay ✅
- A single host (`<igvc-overlay-host>`) attached to `document.documentElement`, with a **closed** Shadow DOM and styles inside the shadow root.
- Elements are created only with `createElement` + `textContent`. Buttons call `stopPropagation()` on `click`, `pointerdown` and `mousedown`, and the active button is highlighted with `aria-pressed`.
- `position: fixed`, `z-index: 2147483647`, `pointer-events: none` on the host and container, `auto` only on the buttons.
- Appears on speed change, on shortcuts or when hovering over the active video, and hides after 2 s. While visible, it follows the video position every frame.

**Decisions:**
- Hover detection: Instagram places layers on top of the `<video>`, so events on the video itself are unreliable. A passive `pointermove` on `document`, throttled with `requestAnimationFrame`, only compares pointer coordinates with the active video's rectangle. Nothing from the page is read.
- On startup, the script removes orphaned `<igvc-overlay-host>` hosts left by a previous injection. This is the only DOM query that is not for `<video>`, and it only looks for the extension's own element. It guarantees at most one overlay.

## Step 5 — Automated check ✅
- `scripts/check-security.sh` (bash + grep + Python 3 stdlib). Auto-detects `python3`/`python`, since on Windows `python3` may only be the Microsoft Store shortcut.
- Covers all terms from section 2.2. Also covers string timers, `createElement` of `script`/`img`/`iframe`/`link`/etc., `src`/`href` assignment, `Function(`, `importScripts` and any `chrome.*`.
- Manifest: text search for forbidden terms plus structural validation (forbidden keys at any level, `"MAIN"` value, exact `matches`, `all_frames: false`, `run_at: document_idle`, no extra top-level keys, CSP).
- Zip: filename allowlist (`manifest.json`, `content.js`, `icons/*.png`). The content is then extracted to a temporary folder and goes through the same checks.
- **Negative test:** on a copy with injected violations (`console.log`, `innerHTML`, string timer, `.src =`, `permissions`, `<all_urls>`, `evil.js` in the zip), the script caught all of them and exited with code 1.
- Result on the real folder: **PASSED (exit 0)**.

## Step 6 — Packaging and README ✅
- `ig-video-controller.zip` built with Python's `zipfile`, containing only `manifest.json`, `content.js` and `icons/{16,48,128}.png`.
- Check re-run on the folder and the zip: **PASSED**.
- `README.md` with features, shortcuts, privacy, permissions, installation and verification.

To rebuild the zip after changes:
```bash
python -c "import zipfile; z=zipfile.ZipFile('ig-video-controller.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p) for p in ('manifest.json','content.js','icons/16.png','icons/48.png','icons/128.png')]; z.close()"
bash scripts/check-security.sh
```

## Step 7 — Test checklist ✅
- A 7-item checklist (plus one extra) in the README for the user to run in Chrome.

## Logic tests run by the agent
Node simulation with a minimal fake DOM, no dependencies and outside the project. It validated:
- the single-instance guard (a second injection adds no listener);
- the presets and the 4x/0.25x limits;
- unmapped keys and keys with modifiers being ignored;
- `input`/`contenteditable` fields being ignored;
- a `playbackRate` reset by the site being reapplied without looping;
- seeking clamped at 0;
- pause and resume;
- a new video inheriting the speed;
- listeners registered only once after several scans;
- a single overlay host.

No test was run on the real Instagram: per section 2.4, that is up to the user.

## Iteration 2 — Interactive progress bar (Facebook style) ✅
User request: an interactive bar, hidden by default, visible on hover or while paused, thin, with a handle on hover, and the overlay moved to the bottom edge of the video.

- **Position:** the overlay spans the video width and is aligned to its bottom edge, clamped to the visible viewport area. It has a dark gradient background.
- **Content:** a row with the speed, `1x`/`1,5x`/`2x` and the time `m:ss / m:ss` (`h:mm:ss` past 1 h). The bar sits below it.
- **Bar:** 14 px tall hit area with a 3 px visible line. On hover or while dragging, the line grows to 5 px and a 12 px handle scales in. All done with CSS inside the closed Shadow DOM.
- **Dragging:** uses Pointer Events with `setPointerCapture`. The video stays fixed during the drag (`dragVideo`) even if the "active video" changes. The position is clamped to [0, duration], and `stopPropagation` on `pointerdown`/`pointerup`/`mousedown`/`mouseup`/`click` keeps Instagram from pausing or resuming the video.
- **Visibility:** the overlay appears on hover over the video, on the active video's `pause` event and on speed change. It stays visible while the video is paused, during a drag or while the pointer is over the controls.
- **Invalid duration** (`NaN`/`Infinity`, as in live streams): the bar is disabled and only the current time is shown.
- New per-video `pause` listener, also registered only once (controlled by the same `WeakSet`).

**Bug fixed during testing:** `getActiveVideo()` prioritized any playing video, even one **off-screen**. When the visible Reel was paused, an invisible video that kept playing "stole" the overlay and shortcuts (including `V` to resume). Now only a playing **and visible** video has priority, then the most visible one, then any playing video.

**Tests:** the Node simulation was extended and passed. It covers:
- dragging to 50% and 80%, clamped at the end;
- a different `pointerId` being ignored;
- no event propagation;
- the fill and the time text;
- visibility while playing, paused and then resumed;
- infinite duration;
- the `pause` listener registered only once.

The attempt at visual verification with headless Chrome was inconclusive: in headless mode, `IntersectionObserver` and `requestAnimationFrame` did not run consistently. The bottom-edge layout showed up in one of the captures, but the final look must be checked by the user (checklist item 8).

## Iteration 3 — Time on the left ✅
- The time text, previously on the right, covered Instagram's volume control. It is now the first item in the row, before the speed, and all controls sit on the left. The automatic margin (`margin-left: auto`) was removed and there is a 4 px gap between the time and the speed.

## Browser validation ✅
- 2026-11-17: the user ran the README test checklist in Chrome on the real Instagram, and every item worked.

## Iteration 4 — Repository, documentation and English ✅
- Git repository created and published at https://github.com/AlanRedael/IG-Video-Controller (`main`). `.gitattributes` enforces LF line endings so `check-security.sh` does not break on Windows, and `.gitignore` excludes the `.zip`.
- Tag `v1.0.0` pushed. The GitHub Release still has to be created by the user, because `gh` is not installed and using the git credential against the API was blocked by Claude Code's permission system.
- New `docs/release-notes/` folder, with one file per version (`v1.0.0.md`) and a `README.md` describing the release steps.
- `README.md` is now in English. `PROGRESSO.md` stays in Portuguese, and this file is its English version.
- Comments in `content.js` and `check-security.sh` translated to English. The script's output messages too, to avoid mixing languages: the result is now `RESULT: PASSED` / `RESULT: FAILED`. No logic was changed.
- Intentionally left in Portuguese: the UI labels (`1,5x`, with a decimal comma, as in the specification) and the `description` in `manifest.json`, which the specification says to use exactly as given.

## Iteration 5 — Working rules (CLAUDE.md) ✅
- New `CLAUDE.md` with rules for anyone developing the project with Claude Code:
  - never expose credentials;
  - commits grouped by context;
  - Conventional Commits 1.0.0;
  - Semantic Versioning 2.0.0.
- It also includes a summary of the original specification's security constraints, so they are recorded in the repository.

## Known limitations
- If the extension is reloaded without reloading the page, the old (orphaned) script stays active in the tab until the page is reloaded. Chrome does not inject the new script into tabs that are already open, so there is no duplication. Detecting the orphaned script would require `chrome.runtime`, which is forbidden.
- Pausing with `V` calls `video.pause()` directly, and Instagram's own play/pause icon may not reflect the change right away.
