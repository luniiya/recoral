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
- [x] Admin page (`/admin`, reachable via avatar menu): server status, registered users list, "allow sign ups" toggle, and an optional fixed accent color for the logged-out login page (random per visit by default).
- [ ] Real admin/role concept. Right now `/api/admin/*` just requires *any* logged-in user, there's no actual admin flag, fine for a single-person instance, not fine the moment there's more than one real account.
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

## Transcription

- [ ] Pick transcription approach on the server (model, chunking for long recordings)
- [ ] Decide on speaker diarization, yes or no
- [ ] Decide if local/on-device transcription is ever supported in offline mode, or always server-only

## Later / unsorted

- [ ] Domain + GitHub repo availability check for "recoral"
- [ ] Branding, coral color theme
