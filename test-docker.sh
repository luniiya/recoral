#!/usr/bin/env bash
# Simulates exactly what an end user does per the README's Quick Start,
# using the images already built on this machine instead of pulling from
# GHCR (nothing's published yet). Runs from a throwaway dir under /tmp, not
# the repo, so bind-mount defaults (./data next to the compose file) land
# somewhere real and disposable instead of inside the repo checkout, same
# as they would for an actual user who never cloned this repo at all.
set -euo pipefail
cd "$(dirname "$0")"

echo "Stopping any repo-local compose stack (would otherwise clash on :7245)..."
docker compose down 2>/dev/null || true

echo "Building local images..."
docker compose build recoral transcription

echo "Tagging local images as the published ones, so docker-compose.release.yml can use them without a real registry pull..."
docker tag recoral-recoral:latest ghcr.io/luniiya/recoral:latest
docker tag recoral-transcription:latest ghcr.io/luniiya/recoral-transcription:latest

TESTDIR=$(mktemp -d /tmp/recoral-install-test.XXXXXX)
echo "Simulating a fresh install in $TESTDIR"
cp docker-compose.release.yml "$TESTDIR/docker-compose.yml"
cp .env.example "$TESTDIR/.env"

cd "$TESTDIR"
docker compose up -d

echo ""
echo "Up at http://localhost:7245"
echo "Recordings/database landed in: $TESTDIR/data"
echo "Whisper models landed in:      $TESTDIR/data/models"
echo ""
echo "Tear down: (cd $TESTDIR && docker compose down) && rm -rf $TESTDIR"
