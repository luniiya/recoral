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

- [ ] Account system on the server (signup, login, sessions/tokens)
- [ ] Server picker + login screen on mobile first launch (Immich-style)
- [ ] "Go offline" option on first launch, skips server/account entirely

## Local-first / offline mode

- [ ] On-device SQLite schema for recordings (works standalone, no account needed)
- [ ] Fully offline mode: record, store, browse, no server ever contacted
- [ ] Outbox/sync-queue schema, only used once a server + account is configured
- [ ] Sync trigger on app foreground, best-effort background sync as a bonus

## Recording

- [ ] Web/browser mic recording (desktop webUI)
- [ ] Native mic recording on mobile via `capacitor-audio-recorder`
- [ ] Background recording support (Android foreground service, iOS Background Modes)

## Transcription

- [ ] Pick transcription approach on the server (model, chunking for long recordings)
- [ ] Decide on speaker diarization, yes or no
- [ ] Decide if local/on-device transcription is ever supported in offline mode, or always server-only

## Later / unsorted

- [ ] Domain + GitHub repo availability check for "recoral"
- [ ] Branding, coral color theme
