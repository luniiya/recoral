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
- [ ] Recordings are still client-memory-only, nothing persists to the server yet. Needs a `recordings` table + upload endpoint before any of this survives a refresh or syncs across devices.
- [ ] Native mic recording on mobile via `capacitor-audio-recorder`
- [ ] Background recording support (Android foreground service, iOS Background Modes)

## Tags

- [x] Tags: name + configurable color, full CRUD (create/rename/recolor/delete), assignable per recording, filterable from the header
- [ ] **Subtags idea** (brainstormed, not built): let a tag name itself encode hierarchy, e.g. `voiceacting/certainvoice` instead of a flat `certainvoice`. Recommendation from that discussion:
  - Don't add a schema change (no `parent_id` column) yet. Keep `name` a plain string and just allow `/` in it, same `tags` table as today.
  - UI parses the `/` client-side to render hierarchy: an indented tree on the Tags page, breadcrumb-style chips elsewhere (`voiceacting › certainvoice`), grouping headers, etc. Purely presentational, no new API shape.
  - Cheap and reversible. If it turns out real hierarchy is needed (rename a parent and cascade to children, move a subtree, etc.), migrate to a proper `parent_id` self-reference then, not before.
  - Not yet started: no `/` parsing anywhere in the current Tags UI or `TagChips`, tag names are treated as flat strings today.

## Data export / import

- [ ] "Export your data" button (Settings): downloads everything for the current account, recordings, transcripts, tags, descriptions, in recoral's own format. Depends on recordings actually being persisted server-side first.
- [ ] "Import your data" button (Settings), with a choice of source format:
  - recoral's own export format (round-trips with the export above)
  - Google Takeout data (Google Recorder's export), since recoral is explicitly a Google Recorder replacement, letting people migrate their existing recordings in is a natural onboarding path. Needs research into what Google Takeout actually ships for Recorder (audio file format, transcript format, metadata layout) before this can be scoped properly.

## Transcription

- [ ] Pick transcription approach on the server (model, chunking for long recordings)
- [ ] Decide on speaker diarization, yes or no
- [ ] Decide if local/on-device transcription is ever supported in offline mode, or always server-only

## Later / unsorted

- [ ] Domain + GitHub repo availability check for "recoral"
- [ ] Branding, coral color theme
