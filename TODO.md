# TODO

## Scaffolding

- [x] Root `package.json` with Bun workspaces (`server`, `web`, `packages/*`)
- [x] `server/` skeleton, Bun HTTP server, basic routing, serves `web/build` with SPA fallback
- [x] `web/` skeleton, SvelteKit with `adapter-static`
- [x] `packages/shared` for shared TS types/DTOs
- [ ] `mobile/` Capacitor project wrapping `web/`
- [x] Dockerfile (multi-stage, builds web then ships a slim Bun runtime image) + docker-compose for the server
- [x] `start-dev.sh` to run server + web dev servers together

## Accounts / auth

- [x] Account system on the server (signup, login, sessions/tokens). Username required, email optional, login works with either. Per-user accent color (custom hue picker), avatar upload.
- [x] Real `isAdmin` flag on users, first registered account becomes admin automatically, `/api/admin/*` requires it server-side (403 otherwise), Administration button hidden client-side for non-admins too. Admins can promote/demote other users and set a per-user storage quota (MB, "Unlimited" if unset) from `/admin`; can't remove their own admin access.
- [x] Admin page (`/admin`, reachable via avatar menu, own layout with no sidebar): server status + version, users list, "allow sign ups" toggle, optional fixed accent color for the logged-out login page (random per visit by default), optional login page background image upload.
- [ ] First-run setup screen (Immich-style): when a fresh server has zero users, the webUI should show a dedicated "set up your server" flow instead of the normal login/signup form, create the first (admin) account there. Right now the first registered user silently becomes admin with no distinct onboarding experience.
- [ ] Server picker + login screen on mobile first launch (Immich-style)
- [ ] "Go offline" option on first launch, skips server/account entirely

## Local-first / offline mode

- [ ] On-device SQLite schema for recordings (works standalone, no account needed)
- [ ] Fully offline mode: record, store, browse, no server ever contacted
- [ ] Outbox/sync-queue schema, only used once a server + account is configured
- [ ] Sync trigger on app foreground, best-effort background sync as a bonus

## Recording

- [x] Web/browser mic recording (desktop webUI), plus importing existing audio files (mp3 etc.)
- [x] Recordings now persist server-side. `recordings` + `recording_tags` tables, audio files stored on disk under `DATA_DIR/recordings/<userId>/<id>.<ext>` (metadata in SQLite, blobs on the filesystem, same split Immich uses). Full CRUD (`GET/POST /api/recordings`, `PATCH/DELETE /api/recordings/:id`, `GET /api/recordings/:id/audio`, tag attach/detach), survives refreshes and is shared across devices/sessions for the same account now.
- [x] Server-side duplicate detection: SHA-256 content hash computed on upload, rejects true duplicates (409) regardless of filename. Authoritative on the server now, the old client-only hash check was removed when recordingsStore moved to talking to the API.
- [x] Storage quota enforcement wired to real usage: uploads are rejected (413) once a user's own override limit or the shared global pool is exceeded. Trash auto-purges after 30 days on every list fetch (server-side, no cron needed at this scale) and actually deletes the file from disk.
- [x] Card system reworked to a list + detail split (Google Recorder-style): cards in the list are now read-only and clickable, selecting one shrinks the list into a left rail and slides in a detail panel on the right (`RecordingDetail.svelte`). Title/description editing, favorite/archive/trash, and tag assignment all moved from the card into the detail panel. Detail panel has Audio/Transcription tabs (Transcription shows the transcript or "No transcription yet", nothing wired to a real pipeline yet) and a persistent custom transport bar.
- [x] Replaced the native `<audio controls>` element everywhere (detail panel, Bin, Archive, Favourites) with a custom `AudioPlayer.svelte`: play/pause, ±10s skip, draggable seek bar, elapsed/remaining time, speed cycle (1x/1.5x/2x), and a volume control with a proper logarithmic taper (equal slider steps ≈ equal dB steps) instead of raw linear gain, which is what made the native/naive version feel unresponsive for most of its range then jump hard near the top.
- [x] Real waveform visualization built (`Waveform.svelte`): Web Audio API decode + peak extraction client-side, zoomable (+/- buttons), scrolls under a fixed centered playhead synced to live playback position.
- [ ] **Bug**: playback position still visibly teleports/jumps on pause and/or resume in some cases (both the big `Waveform.svelte` view and the seek bar in `AudioPlayer.svelte`), despite multiple attempted fixes this session (rAF-driven live reads of `audioEl.currentTime` instead of the sparse `timeupdate`-driven prop, on both the playing and paused branches). Root cause not yet confirmed; needs fresh investigation, possibly starting over with console logging (`console.debug` calls were added and removed during debugging, see git history) captured across an actual pause→resume cycle rather than just a resume.
- [ ] Material 3 "wavy" seek bar indicator (`AudioPlayer.svelte`, wave scroll/mask CSS + custom pointer-driven track replacing the native `<input type=range>`): built and gated behind a user setting (Account Settings → Appearance → "Wavy playback indicator"), but disabled by default for now because it looks rough (wobble shape/timing needs more polish) and is tangled up with the teleport bug above. Revisit once the teleport bug is fixed.
- [ ] Native mic recording on mobile via `capacitor-audio-recorder`
- [ ] Background recording support (Android foreground service, iOS Background Modes)
- [ ] `docker-compose.yml` was fixed to actually set `DATA_DIR=/data` so the mounted volume is used, this was found and patched during the persistence work but is worth a mention: verify a real container restart preserves data before calling this solid.

## Tags

- [x] Tags: name + configurable color, full CRUD (create/rename/recolor/delete), assignable per recording, filterable from the header
- [ ] **Subtags idea** (brainstormed, not built): let a tag name itself encode hierarchy, e.g. `voiceacting/certainvoice` instead of a flat `certainvoice`. Recommendation from that discussion:
  - Don't add a schema change (no `parent_id` column) yet. Keep `name` a plain string and just allow `/` in it, same `tags` table as today.
  - UI parses the `/` client-side to render hierarchy: an indented tree on the Tags page, breadcrumb-style chips elsewhere (`voiceacting › certainvoice`), grouping headers, etc. Purely presentational, no new API shape.
  - Cheap and reversible. If it turns out real hierarchy is needed (rename a parent and cascade to children, move a subtree, etc.), migrate to a proper `parent_id` self-reference then, not before.
  - Not yet started: no `/` parsing anywhere in the current Tags UI or `TagChips`, tag names are treated as flat strings today.

## Data export / import

- [ ] "Export your data" button (Settings): downloads everything for the current account, recordings, transcripts, tags, descriptions, in recoral's own format. Recordings now persist server-side so this is unblocked, not yet built.
- [ ] "Import your data" button (Settings), with a choice of source format:
  - recoral's own export format (round-trips with the export above)
  - Google Takeout data (Google Recorder's export), since recoral is explicitly a Google Recorder replacement, letting people migrate their existing recordings in is a natural onboarding path. Needs research into what Google Takeout actually ships for Recorder (audio file format, transcript format, metadata layout) before this can be scoped properly.
  - **Promoted to top priority**: this is a personal-necessity feature for the user, whose own Google Recorder app is bricked from too many recordings, not just a nice-to-have for other users. User requested their own Takeout export (2026-07-12), expected to land ~2026-07-13. Once it arrives, the actual `.zip`/folder structure needs reverse-engineering (Google doesn't document the Recorder export format) before anything can be built against it.
  - Rough shape of the plan so far (not decided, just brainstormed): a dedicated Import/Export section in Settings, drag-and-drop (or file picker) upload of the Takeout archive, server-side processing of the archive after upload (not client-side, since these can be large). Explicit concern raised: a single Takeout export could contain a very large number of recordings, so the backend needs to process this in a memory-safe/streaming way (e.g. stream-unzip and import recordings one at a time or in small batches, not load the whole archive into memory at once) rather than assuming small/typical upload sizes like the existing single-file `POST /api/recordings` path does.

## Transcription

- [ ] Pick transcription approach on the server (model, chunking for long recordings)
- [ ] Decide on speaker diarization, yes or no
- [ ] Decide if local/on-device transcription is ever supported in offline mode, or always server-only
  - Confirmed technically feasible via phone NPU: iOS `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` (built-in, free, Apple maintains the model), Android via ML Kit on-device speech-to-text or a bundled quantized Whisper (`whisper.cpp`/`whisper.tflite`, `tiny`/`base` models run fast on modern NPUs). Precedent: Google's own Pixel Recorder app already transcribes fully on-device via the Tensor NPU.
  - Real-time word-by-word streaming isn't required, fast on-device batch transcription right after recording covers the voice-memo use case fine and is much simpler.
  - Needs a custom Capacitor native plugin (Swift + Kotlin) bridging to the platform ASR API or bundled model runtime, not reachable from the WebView/JS layer directly. Same shape of native work as the `capacitor-audio-recorder` plugin already planned for background recording, but a second plugin specific to transcription.
  - On-device is the only way fully-offline-mode users (no account, no server, ever) get transcripts at all, fits the "offline is first-class" principle hard. But it doesn't help the desktop webUI (no NPU access from a browser), so a server-side transcription path is still needed regardless, meaning two pipelines to maintain if both are built, not one.

## Later / unsorted

- [ ] Domain + GitHub repo availability check for "recoral"
- [ ] Branding, coral color theme
