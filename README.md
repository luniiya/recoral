<img src="design/banner%20wide%20downscaled.png" alt="recoral" width="100%" />

Self-hostable voice recorder, a Google Recorder replacement, the vision is pretty much [Immich](https://github.com/immich-app/immich)'s architecture but for audio instead of photos.

<img width="2256" height="1504" alt="image" src="https://github.com/user-attachments/assets/bca40b4c-ef9b-47ef-95f8-5eaf728b1ab8" />

## What it will do

- Record audio on your phone or from the browser
- Automatic transcription, handled server-side
- Self-hosted: your server, your data
- On mobile, you're prompted for a server on first launch, just like Immich. Enter a server and log into your account to record and sync, or hit "go offline" to skip all of that and use the app fully locally with no account and no server at all.
- Once connected to a server and logged in, recordings save locally first and sync to the server through an outbox queue whenever it's reachable. Sync is best effort, the app never depends on it.

## Quick start

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/luniiya/recoral/main/docker-compose.release.yml
curl -o .env https://raw.githubusercontent.com/luniiya/recoral/main/.env.example
docker compose up -d
```

Then open `http://localhost:7245` (or whatever port you set in `.env`).

Transcription runs CPU-only by default. If you have a compatible AMD GPU
(ROCm, gfx1100/gfx1101 tested), see the comments in `docker-compose.yml` for
the GPU-accelerated variant.

Android APK builds are attached to each [GitHub release](https://github.com/luniiya/recoral/releases). iOS isn't built yet.
