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
# GGML_NATIVE=OFF: without it, ggml's CPU backend probes the build host for
# -march=native and bakes that into the compile flags. Under QEMU's arm64
# emulation (see the workflow's setup-qemu-action step, needed for the
# Raspberry Pi target) that probe reads bogus/inconsistent SVE2 feature bits
# from the emulated /proc/cpuinfo, producing a malformed -march string that
# binutils' `as` rejects outright ("must specify extensions to add before
# specifying those to remove"), breaking the arm64 leg of this multi-arch
# build. Disabling native detection makes it use a portable default instead.
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF \
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
