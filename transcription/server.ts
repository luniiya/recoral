import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Thin HTTP wrapper around the whisper-cli binary built by this service's
// own Dockerfile (whisper.cpp compiled from source with the ROCm/HIP
// backend). Deliberately not whisper.cpp's own bundled server: that server
// loads one fixed model for its whole lifetime, but recoral's admin can pick
// the model per-request (Settings.transcriptionModel), so a CLI invocation
// per request is simpler than juggling a multi-model long-running process.

const MODELS_DIR = process.env.MODELS_DIR ?? "/models";
const WHISPER_CLI = process.env.WHISPER_CLI ?? "/app/whisper.cpp/build/bin/whisper-cli";
const PORT = Number(process.env.PORT) || 8090;

type TranscriptionModel = "tiny" | "base" | "small" | "medium" | "large";

const MODEL_FILES: Record<TranscriptionModel, string> = {
	tiny: "ggml-tiny.bin",
	base: "ggml-base.bin",
	small: "ggml-small.bin",
	medium: "ggml-medium.bin",
	large: "ggml-large-v3.bin"
};

const HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

await mkdir(MODELS_DIR, { recursive: true });

// The GPU is a single-consumer resource: only one whisper-cli process runs
// at a time, everything else queues behind it. The main recoral server
// already serializes its own calls into this service, this lock is just a
// defensive second layer in case that ever changes.
let busy = false;
const waiters: (() => void)[] = [];

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
	if (busy) await new Promise<void>((resolve) => waiters.push(resolve));
	busy = true;
	try {
		return await fn();
	} finally {
		busy = false;
		waiters.shift()?.();
	}
}

// Models are downloaded on first use into MODELS_DIR (a mounted volume, see
// docker-compose.yml), not baked into the image, so switching the admin
// setting to a model that hasn't been fetched yet doesn't require a rebuild.
const downloading = new Map<string, Promise<void>>();

async function ensureModel(model: TranscriptionModel): Promise<string> {
	const filename = MODEL_FILES[model];
	const path = join(MODELS_DIR, filename);
	if (existsSync(path)) return path;

	let promise = downloading.get(filename);
	if (!promise) {
		promise = (async () => {
			const res = await fetch(`${HF_BASE}/${filename}`);
			if (!res.ok || !res.body) throw new Error(`Failed to download model ${filename}: ${res.status}`);

			// Bun.write() doesn't reliably stream a fetch Response in this Bun
			// version: passing the Response itself hangs forever (confirmed by
			// hand), and passing res.body directly just stringifies the stream to
			// "[object ReadableStream]" instead of writing its bytes. Pumping the
			// stream through a file writer by hand is what actually works.
			// Downloaded to a .download sibling and renamed into place once
			// complete, so a request that checks MODELS_DIR mid-download never
			// sees a truncated file.
			const tmpPath = `${path}.download`;
			const writer = Bun.file(tmpPath).writer();
			for await (const chunk of res.body) writer.write(chunk);
			await writer.end();
			await rename(tmpPath, path);
		})();
		downloading.set(filename, promise);
		promise.finally(() => downloading.delete(filename));
	}
	await promise;
	return path;
}

async function run(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);
	return { stdout, stderr, exitCode };
}

Bun.serve({
	port: PORT,
	routes: {
		"/health": () => Response.json({ status: "ok" }),
		"/transcribe": {
			POST: async (req) => {
				const form = await req.formData();
				const file = form.get("file");
				const modelRaw = form.get("model");
				const model: TranscriptionModel =
					typeof modelRaw === "string" && modelRaw in MODEL_FILES ? (modelRaw as TranscriptionModel) : "small";

				if (!(file instanceof File)) return Response.json({ error: "A file is required" }, { status: 400 });

				const workDir = join(tmpdir(), `transcribe-${crypto.randomUUID()}`);
				await mkdir(workDir, { recursive: true });
				const inputPath = join(workDir, `input-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
				const wavPath = join(workDir, "audio.wav");
				const outBase = join(workDir, "out");

				try {
					await Bun.write(inputPath, file);

					// ffmpeg normalizes whatever comes in (webm/opus from the browser
					// recorder, m4a/mp3 from imports, anything ffmpeg understands) to
					// the 16kHz mono PCM wav whisper.cpp expects, rather than relying
					// on whisper.cpp's own limited built-in decoders for every format
					// recoral might have stored.
					const ffmpeg = await run([
						"ffmpeg",
						"-y",
						"-i",
						inputPath,
						"-ar",
						"16000",
						"-ac",
						"1",
						"-c:a",
						"pcm_s16le",
						wavPath
					]);
					if (ffmpeg.exitCode !== 0) {
						return Response.json({ error: `ffmpeg failed: ${ffmpeg.stderr.slice(-2000)}` }, { status: 500 });
					}

					const modelPath = await ensureModel(model);

					const result = await withLock(() =>
						run([WHISPER_CLI, "-m", modelPath, "-f", wavPath, "-l", "auto", "-otxt", "-of", outBase, "-np", "-nt"])
					);
					if (result.exitCode !== 0) {
						return Response.json({ error: `whisper-cli failed: ${result.stderr.slice(-2000)}` }, { status: 500 });
					}

					const text = (await readFile(`${outBase}.txt`, "utf-8")).trim();
					return Response.json({ text });
				} finally {
					await rm(workDir, { recursive: true, force: true });
				}
			}
		}
	}
});

console.log(`recoral transcription service listening on http://localhost:${PORT}`);
