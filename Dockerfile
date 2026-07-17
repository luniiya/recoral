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

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/server ./server
COPY --from=build /app/web/build ./web/build

EXPOSE 3000
CMD ["bun", "run", "server/src/index.ts"]
