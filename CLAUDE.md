# CLAUDE.md — working rules for this project

IG Video Controller is a Chrome extension (Manifest V3) that controls playback of Instagram videos.
The whole extension is `manifest.json` + `content.js` + `icons/`. History and decisions: `PROGRESS-EN.md` (English) / `PROGRESSO.md` (Portuguese).

## 1. Credentials and sensitive data — never expose them

- Never print, log, echo, commit or paste into any file, message, commit, tag, release note or URL: tokens, passwords, API keys, cookies, SSH keys, OAuth codes or any authentication data.
- Never read stored credentials (for example `git credential fill`, the Git Credential Manager, `~/.git-credentials`, `gh auth token`, browser profiles) to use them in commands. If an action needs authentication that is not already available to a tool (`git push`, an authenticated `gh`), stop and ask the user.
- Never put credentials on the command line or in environment variables that are echoed.
- Before every commit, review `git diff --staged` for secrets, personal data (emails, names beyond the git author) and local absolute paths. Do not commit `.env`, key files or editor/OS configuration.
- Do not log in to Instagram or interact with accounts, DMs, likes or comments. Testing on the real site is done by the user.

## 2. Commits grouped by context

- One commit per logical change. Do not mix unrelated work in the same commit, for example:
  - feature or fix in `content.js` → its own commit;
  - documentation (`README.md`, `PROGRESS*.md`, `docs/`) → separate commit, unless it only documents the change in the same commit;
  - tooling (`scripts/`), repository setup (`.gitignore`, `.gitattributes`) → separate commit;
  - version bump + release notes → a dedicated `chore(release)` commit.
- Stage files explicitly (`git add <paths>`). Avoid `git add -A` when the tree has changes from more than one context.
- Every commit must leave the project working: run `bash scripts/check-security.sh` before committing code, `manifest.json` or `scripts/` changes. It must print `RESULT: PASSED`.
- Never rewrite pushed history (`push --force`, `rebase` or `amend` on pushed commits) without explicit user approval.
- Commit or push only when the user asks.

## 3. Commit messages — Conventional Commits 1.0.0

Format (in English):

```
<type>(<optional scope>): <subject>

<optional body: what and why, wrapped at 72 columns>

<optional footers>
```

- **Subject:** imperative mood ("add", not "added"/"adds"), lowercase start, no trailing period, max ~72 characters.
- **Types:** `feat` (new feature), `fix` (bug fix), `docs`, `style` (formatting only), `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scopes used in this project:** `content` (content.js), `overlay`, `shortcuts`, `manifest`, `icons`, `security` (check script), `docs`, `release`, `repo`.
- **Breaking changes:** add `!` after the type/scope and a `BREAKING CHANGE: <description>` footer.
- Examples:
  - `feat(overlay): add interactive progress bar`
  - `fix(content): ignore off-screen playing videos when picking the active one`
  - `docs: translate README to English`
  - `chore(release): 1.1.0`

## 4. Versioning — Semantic Versioning 2.0.0

The version lives in `manifest.json` (`"version": "MAJOR.MINOR.PATCH"`) and in the git tag `vMAJOR.MINOR.PATCH`.

- **MAJOR:** incompatible changes for users: removing or remapping shortcuts, removing features, changing default behavior in a way users must relearn. Any change to the extension's permissions or matched sites is also MAJOR **and** requires explicit user approval first (see section 5).
- **MINOR:** new backward-compatible features (new shortcut, new overlay control, new option).
- **PATCH:** backward-compatible bug fixes, performance and visual tweaks that change no behavior.
- Docs-only, tooling-only or comment-only changes do not need a new version.
- Any change to what ships in the zip (`manifest.json`, `content.js`, `icons/`) that is visible to users needs a new version. This includes metadata such as the manifest `description`, which is a PATCH.
- **Version proactively:** whenever a change warrants a new version, do the bump and the full release flow below as part of the task, without waiting to be asked. Tell the user which version was chosen and why.
- Chrome only accepts 1–4 dot-separated integers in `"version"`, so pre-release labels (`-beta.1`) may be used **only in git tags**, never in `manifest.json`.
- Release flow (details in `docs/release-notes/README.md`):
  1. bump `manifest.json`;
  2. write `docs/release-notes/vX.Y.Z.md`;
  3. build the zip and run the security check;
  4. `chore(release): X.Y.Z` commit;
  5. annotated tag `vX.Y.Z`;
  6. GitHub release with the notes and the zip. If no authenticated `gh` is available, push the tag and ask the user to create the release on the website. Never read stored credentials to do it.
- Never move or delete a published tag.

## 5. Non-negotiable extension constraints

If a task seems to require breaking any of these, stop and ask the user.

- **Manifest:** `manifest_version: 3`; no `permissions`, `optional_permissions` or `host_permissions`; only `content_scripts.matches: ["https://www.instagram.com/*"]`; no `background`, `action`, `options_page`, `web_accessible_resources`, `externally_connectable`, `devtools_page` or `world: "MAIN"`; `all_frames: false`, `run_at: "document_idle"`.
- **Code (`content.js`):**
  - Zero network: no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, dynamic `import()`, and no created elements with `src`/`href`.
  - Zero dynamic execution: no `eval`, `new Function`, or string timers.
  - Zero HTML strings: no `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`. Use `createElement` + `textContent`.
  - Zero messaging or storage: no `chrome.*` APIs, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` or `postMessage`.
  - Only query `<video>` elements; never read page text, attributes, URLs or user data.
  - Keyboard handler ignores editable targets and Ctrl/Meta/Alt; never record keys.
  - No `console.*`, no third-party dependencies, a single `content.js`.
  - Rate values only from frozen constants, validated with `Number.isFinite` and clamped to 0.25–4.
- **Single instance:** a `globalThis.__igvcLoaded` guard; a `WeakSet` of controlled videos; one `keydown` listener, one `MutationObserver`, one overlay host in a closed Shadow DOM.
- **Distribution zip** contains only `manifest.json`, `content.js` and `icons/`. It is not committed (see `.gitignore`).
- Do not install packages or download files, do not change Chrome settings and do not publish to the Chrome Web Store.
- Code comments, repository docs and the manifest `description` are in English. The overlay labels keep the decimal comma (`1,5x`) from the original specification. `PROGRESSO.md` is the Portuguese log, so keep `PROGRESSO.md` and `PROGRESS-EN.md` in sync.
