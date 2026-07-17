# Builds whisper.cpp from source, CPU-only. Originally targeted ROCm/HIP for
# an AMD RX 7900 XTX/7800 XT (gfx1100/gfx1101), based on a wrong assumption
# about the real deployment server's hardware, discovered only once actually
# deployed there: it's an Intel Jasper Lake N5105 with no GPU capable of any
# of this. Revisit a GPU backend only if self-hosting on real GPU hardware
# becomes an actual target again, and confirm the hardware first next time.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
		git cmake build-essential ffmpeg ca-certificates curl unzip \
	&& rm -rf /var/lib/apt/lists/*

# Bun runs the thin HTTP wrapper (server.ts) around the whisper-cli binary.
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git whisper.cpp
WORKDIR /app/whisper.cpp
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
	&& cmake --build build --config Release -j"$(nproc)"

WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY server.ts ./

ENV MODELS_DIR=/models
ENV WHISPER_CLI=/app/whisper.cpp/build/bin/whisper-cli
ENV PORT=8090

EXPOSE 8090
CMD ["bun", "run", "server.ts"]
