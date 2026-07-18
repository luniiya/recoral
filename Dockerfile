FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY mobile/package.json mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --cwd web build

FROM oven/bun:1-alpine
WORKDIR /app

# ffprobe (part of ffmpeg) reads the real creation date/duration out of
# imported audio files (e.g. Google Takeout's .m4a exports), see takeoutImport.ts
RUN apk add --no-cache ffmpeg

# A fresh, production-only install here instead of copying the build stage's
# node_modules wholesale: that one carries every workspace's
# devDependencies (Vite, SvelteKit, Tailwind, TypeScript, svelte-check, ...)
# since building the web app needs them, none of which the server actually
# runs with, it only serves the web app's already-built static output. This
# alone was most of what made the final image ~2.8GB.
COPY package.json bun.lock ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY mobile/package.json mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --production --frozen-lockfile

# @recoral/shared is linked into node_modules as a symlink to this real
# path (workspace:* protocol), not copied/bundled by bun install, so the
# actual source has to exist here too, not just its package.json above, or
# the symlink resolves to a directory missing src/index.ts at runtime.
COPY packages/shared packages/shared

COPY --from=build /app/server ./server
COPY --from=build /app/web/build ./web/build

EXPOSE 7245
CMD ["bun", "run", "server/src/index.ts"]
