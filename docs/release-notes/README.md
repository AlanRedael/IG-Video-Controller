# Release notes

One file per version, named after its git tag: `v<major>.<minor>.<patch>.md` (for example, `v1.0.0.md`).
The file content is pasted as-is into the GitHub release description.

## Releasing a new version

1. Bump `"version"` in `manifest.json`.
2. Write `docs/release-notes/v<version>.md`, using the latest file as a model.
3. Build the zip and run the security check (see the main [README](../../README.md#security-check-for-developers)). It must print `RESULT: PASSED`.
4. Commit, then create and push the tag:
   ```bash
   git tag -a v<version> -m "IG Video Controller <version>"
   git push origin main v<version>
   ```
5. Create the release on GitHub from that tag. Use `IG Video Controller <version>` as the title, paste the notes file as the description and attach `ig-video-controller.zip`.
   With the GitHub CLI installed and authenticated:
   ```bash
   gh release create v<version> ig-video-controller.zip \
     --title "IG Video Controller <version>" \
     --notes-file docs/release-notes/v<version>.md
   ```
