#!/usr/bin/env bash

SERVER_PID=""
WEB_PID=""

cleanup() {
    [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null
    [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null
    exit 0
}
trap cleanup INT TERM

bun run --cwd server dev &
SERVER_PID=$!

bun run --cwd web dev &
WEB_PID=$!

echo "recoral dev running, server on :3000, web on :5173, Ctrl+C to quit"

wait
