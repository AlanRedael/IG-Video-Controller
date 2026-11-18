# IG Video Controller

A Google Chrome extension (Manifest V3) that adds a **video controller** to Instagram videos (feed, Reels and Stories) on `https://www.instagram.com/*`.

The extension does **only** playback control: speed, skipping back/forward and pause.

## Shortcuts

| Action | Shortcut | Overlay button |
|---|---|---|
| Normal speed (1x) | `R` | `1x` |
| 1.5x speed | `G` | `1,5x` |
| 2x speed | `H` | `2x` |
| Decrease speed (−0.25x) | `S` | — |
| Increase speed (+0.25x) | `D` | — |
| Back 5 seconds | `Z` | — |
| Forward 5 seconds | `X` | — |
| Pause / resume | `V` | ▶ / ❚❚ (left of the progress bar) |

- Speed always stays between **0.25x and 4x**.
- A subtle overlay appears at the **bottom edge of the video** with the time (`0:12 / 0:45`), the current speed and the `1x`, `1,5x` and `2x` buttons (all aligned to the left), plus a **progress bar** with a **play/pause button** on its left.
  - The overlay is hidden and appears when you hover over the video, pause it or change the speed. It stays visible while the video is paused; during playback it hides after ~2 s without interaction.
  - The play/pause button pauses or resumes the video without opening the post, which is what happens when you click the video itself in the feed. Its icon follows the video state (▶ when paused, ❚❚ when playing).
  - The bar is thin. On hover it gets thicker and shows a handle. **Click or drag** to jump to another point in the video.
- The chosen speed **carries over when you switch Reels/videos** while the tab stays open. When you reload the page it goes back to 1x (nothing is persisted between sessions).
- Shortcuts **do not fire** while you are typing (DMs, comments, search) or while `Ctrl`, `Alt` or `Cmd` is held down.

> The overlay labels use a decimal comma (`1,5x`), as defined in the original specification.

## Privacy

**The extension does not collect, store or transmit any data.**

- It makes no network requests.
- It uses no storage (`chrome.storage`, cookies, `localStorage`, etc.).
- It has no background service worker, popup or options page.
- It only reads the page's `<video>` elements. It does not read text, usernames, captions, comments or messages.
- It never records the keys you type.
- All the code lives in a single readable file, `content.js`, with no third-party libraries.

## Permissions shown at install time

The extension **declares no permissions**. Its only access is running the script on `https://www.instagram.com/*`, so Chrome should show only something like:

> **Read and change your data on www.instagram.com**

If any other warning appears, do not install it and check the files.

## Installation (developer mode)

1. Extract `ig-video-controller.zip` into a folder (or use this repository folder directly).
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top-right corner).
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Open or reload `https://www.instagram.com/`.

Ready-to-install zips are attached to each [GitHub release](https://github.com/AlanRedael/IG-Video-Controller/releases).

## Security check (for developers)

```bash
bash scripts/check-security.sh            # checks the folder and the zip, if present
bash scripts/check-security.sh other.zip  # checks a specific zip
```

It only needs `bash`, `grep` and Python 3 (standard library). It exits with code `0` when everything passes.

To build the distribution zip:

```bash
python -c "import zipfile; z=zipfile.ZipFile('ig-video-controller.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p) for p in ('manifest.json','content.js','icons/16.png','icons/48.png','icons/128.png')]; z.close()"
bash scripts/check-security.sh
```

## Repository layout

```
manifest.json            Extension manifest (no permissions)
content.js               The whole extension (single content script)
icons/                   16, 48 and 128 px icons
scripts/check-security.sh
docs/release-notes/      Release notes, one file per version
PROGRESSO.md             Development log (Portuguese)
PROGRESS-EN.md           Development log (English)
CLAUDE.md                Working rules for AI-assisted development (commits, versioning, constraints)
```

## Test checklist

After loading the extension, run these tests and tick each item:

- [ ] **1. Install warning:** in `chrome://extensions` → the extension's *Details*, Chrome shows only access to `www.instagram.com`, with no other permission.
- [ ] **2. Network:** with Instagram open, open DevTools (`F12`) → **Network** tab. Copy the extension ID from `chrome://extensions` and paste it into the filter (or filter by `chrome-extension://`). Browse and use the shortcuts. **No requests** should appear.
- [ ] **3. Presets:** on a video, press `R`, `G` and `H` and click the `1x`, `1,5x` and `2x` buttons. The speed changes and the overlay shows the right value. Clicking a button does **not** pause the video.
- [ ] **4. Persistence within the session:** with 2x active, scroll through several Reels. The speed stays at 2x.
- [ ] **5. Single instance:** with an Instagram tab open, reload the extension in `chrome://extensions`, go back to the tab, reload the page and browse. There is a single overlay, and each key changes the speed only once (for example, `D` from 1x goes to 1.25x, not 1.5x).
- [ ] **6. Typing privacy:** type `g`, `h`, `s`, `d` in a DM, a comment or the search box. The video does **not** change and the letters appear normally in the field.
- [ ] **7. Limits:** press `D` repeatedly; speed stops at **4x**. Press `S` repeatedly; it stops at **0.25x**.
- [ ] **8. Progress bar:**
  - While the video plays, the overlay only appears on hover and hides ~2 s after the pointer stops.
  - When you pause (clicking the video or with `V`), the overlay appears and **stays** visible.
  - Hovering over the bar makes it thicker and shows the handle.
  - Clicking or dragging on the bar changes the video position without pausing or resuming it, and the `0:12 / 0:45` time follows along.
  - While dragging, releasing the mouse outside the video does not trigger any click on Instagram.
- [ ] **9. Play/pause button:** in the main feed, click the button left of the progress bar. The video pauses **without opening the post**, and the icon changes to ▶. Click again; it resumes and the icon changes to ❚❚. Pausing with `V` also updates the icon.
- [ ] **Extra:** `Z`/`X` go back/forward 5 s; `V` pauses and resumes.
