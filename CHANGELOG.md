# Changelog

All notable changes to Antigram are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project uses [Semantic Versioning](https://semver.org/).

## [0.1.0-alpha] — 2026-05-21

The first taggable cut. End-to-end ownership recovery works against real
Meta Instagram exports. Distribution is unsigned Windows binaries via
GitHub Releases plus a CLI for anyone who wants to avoid the GUI.

### What works

**The pipeline.** Drop in a Meta Instagram export ZIP, get back a folder
of properly-dated, geotagged, captioned photos.

- Streams the ZIP without loading it into memory — handles 20+ GB exports.
- Repairs Meta's cp1252-as-UTF-8 mojibake (emoji captions like "ðŸŒ…"
  become "🌅" on the way out).
- Joins comments to their parent posts by media URI.
- Lifts GPS out of the per-media EXIF subarray into a typed `Location`.
- Multi-photo carousels keep their group identity in the filename
  (`_1of3.jpg`, `_2of3.jpg`, `_3of3.jpg`).
- Output folder layout: `YYYY-MM/` buckets + `_metadata/YYYY-MM/<post-id>.json`
  sidecars + `_archive_info.json` at the root.
- EXIF written via the bundled exiftool (`exiftool-vendored`): photos drop
  into Apple Photos / Google Photos / Lightroom / Immich with dates and
  GPS preserved.

**The CLI.**

```sh
pnpm parse <zip>                       # discovery + stats
pnpm reclaim <zip> <out>               # full pipeline
pnpm reclaim <zip> <out> --limit=N     # cap for sanity-check runs
pnpm reclaim <zip> <out> --no-metadata # skip EXIF embedding
```

**The desktop app.** A 5-screen flow over the same pipeline:

1. **Welcome** — pick the ZIP and the output folder.
2. **Parsing** — discovery + parse with live counts.
3. **Gallery** — every post on a card; filter by year, search by caption,
   multi-select. "Select 2024" / "Select all" shortcuts.
4. **Reclaiming** — progress bar with current post id + file counter.
5. **Done** — "Open the folder" reveals it in Explorer.

Recoverable: if anything throws mid-pipeline, you bounce back to Welcome
with a banner and your file picks intact. A "← back" link in the gallery
lets you swap exports without restarting the app.

**Tests.** 85 tests across 11 files:

- pure unit tests (mojibake, paths, reducer)
- integration tests against the synthetic fixture (parser, organizer)
- a real exiftool round-trip (metadata writer)
- subprocess smoke tests for the CLI
- NDJSON wire-contract tests for the Tauri sidecar

CI runs the suite + `cargo check` on Ubuntu and Windows on every push.

### What's not yet here (and why)

- **Upscaling.** Per the plan, Phase 1 ships ownership; Real-ESRGAN +
  GFPGAN come in Phase 2.
- **Stories, Reels, DMs.** Phase 2+.
- **macOS / Linux binaries.** The Windows `.msi` ships unsigned. macOS
  and Linux work in dev mode (`pnpm tauri:dev`) but no signed installer
  yet — that's the next milestone.
- **Code signing.** Apple Developer Program ($99/year) and a Windows code
  cert ($200-400/year) are deferred until/unless the project has the
  donations to cover them. Until then expect a SmartScreen warning on
  Windows ("More info → Run anyway") and an "unidentified developer"
  prompt on macOS (right-click → Open the first time).
- **Photobook generator, "on this day" view, map view.** Stretch goals.
- **Bundled Node binary.** Right now the desktop app shells out to a
  system `node` to run the pipeline sidecar. Future versions will use
  Node's Single Executable Application support to ship a fully
  self-contained installer.

### Distribution

- **Windows `.msi`** attached to the GitHub Release.
- **Source build:** `git clone && pnpm install && pnpm tauri:dev`.
- **CLI-only:** `git clone && pnpm install && pnpm reclaim <zip> <out>`.

[0.1.0-alpha]: https://github.com/jmarcone/antigram/releases/tag/v0.1.0-alpha
