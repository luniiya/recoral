# Builds whisper.cpp from source with the ROCm/HIP backend, targeting
# gfx1100/gfx1101 (RX 7900 XTX / RX 7800 XT) by default. No official
# prebuilt ROCm image exists for whisper.cpp (ggml-org only ships
# CPU/CUDA/Vulkan variants), so this compiles from source against ROCm's
# own HIP toolchain instead.
#
# NOTE: written and reviewed but not build-verified in this environment (no
# AMD GPU / ROCm toolchain available here). Run
# `docker compose build transcription` on the real host; if it fails, the
# most likely fixes are bumping the rocm/dev-ubuntu-22.04 tag to match your
# installed ROCm/driver version, or adjusting AMDGPU_TARGETS for your card.
FROM rocm/dev-ubuntu-22.04:6.2

ARG AMDGPU_TARGETS="gfx1100;gfx1101"

RUN apt-get update && apt-get install -y --no-install-recommends \
		git cmake build-essential ffmpeg ca-certificates curl unzip \
	&& rm -rf /var/lib/apt/lists/*

# Bun runs the thin HTTP wrapper (server.ts) around the whisper-cli binary.
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git whisper.cpp
WORKDIR /app/whisper.cpp
RUN cmake -B build -DGGML_HIP=1 -DAMDGPU_TARGETS="${AMDGPU_TARGETS}" -DCMAKE_BUILD_TYPE=Release \
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
