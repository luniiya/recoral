import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import {
	getRecordingForTranscription,
	listStuckTranscriptions,
	listUntranscribed,
	setTranscriptResult,
	setTranscriptStatus
} from "./recordings";
import { getSettings } from "./settings";

const TRANSCRIPTION_URL = process.env.TRANSCRIPTION_URL ?? "http://transcription:8090";

const queue: string[] = [];
let processing = false;

export function enqueueTranscription(recordingId: string) {
	if (!getSettings().transcriptionEnabled) return;
	if (queue.includes(recordingId)) return;
	setTranscriptStatus(recordingId, "pending");
	queue.push(recordingId);
	void processQueue();
}

export function requeueStuckTranscriptions() {
	if (!getSettings().transcriptionEnabled) return;
	for (const id of listStuckTranscriptions()) {
		if (!queue.includes(id)) queue.push(id);
	}
	void processQueue();
}

export function enqueueAllUntranscribed() {
	if (!getSettings().transcriptionEnabled) return;
	for (const id of listUntranscribed()) {
		if (queue.includes(id)) continue;
		setTranscriptStatus(id, "pending");
		queue.push(id);
	}
	void processQueue();
}

async function processQueue() {
	if (processing) return;
	processing = true;
	try {
		while (queue.length > 0) {
			const id = queue.shift()!;
			try {
				await transcribeOne(id);
			} catch (err) {
				// Defensive catch — transcribeOne has its own try-catch but DB
				// calls outside it (getRecordingForTranscription, setTranscriptStatus)
				// can throw and would otherwise kill the whole queue.
				console.error(`processQueue: unexpected error for ${id}:`, err);
				try { setTranscriptStatus(id, "failed"); } catch {}
			}
		}
	} finally {
		processing = false;
	}
}

// Bun v1.3.x fetch() has a hard-coded 5-minute socket timeout that fires
// regardless of AbortSignal, which is shorter than CPU whisper inference for
// even small files. Node's http module has no built-in timeout, so we use it
// directly to avoid Bun killing long-running transcriptions.
function postMultipart(
	urlStr: string,
	fields: Record<string, string>,
	file: { name: string; data: Buffer; mimeType: string },
	timeoutMs: number
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const boundary = `----RecoralBoundary${Date.now().toString(16)}`;
		const CRLF = "\r\n";

		const parts: Buffer[] = [];
		parts.push(Buffer.from(
			`--${boundary}${CRLF}` +
			`Content-Disposition: form-data; name="file"; filename="${file.name}"${CRLF}` +
			`Content-Type: ${file.mimeType}${CRLF}${CRLF}`
		));
		parts.push(file.data);
		parts.push(Buffer.from(CRLF));
		for (const [name, value] of Object.entries(fields)) {
			parts.push(Buffer.from(
				`--${boundary}${CRLF}` +
				`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
				`${value}${CRLF}`
			));
		}
		parts.push(Buffer.from(`--${boundary}--${CRLF}`));
		const body = Buffer.concat(parts);

		const url = new URL(urlStr);
		const transport = url.protocol === "https:" ? https : http;
		const req = transport.request({
			hostname: url.hostname,
			port: url.port ? parseInt(url.port) : (url.protocol === "https:" ? 443 : 80),
			path: url.pathname + url.search,
			method: "POST",
			headers: {
				"Content-Type": `multipart/form-data; boundary=${boundary}`,
				"Content-Length": body.length,
			},
		}, (res) => {
			const chunks: Buffer[] = [];
			res.on("data", (chunk: Buffer) => chunks.push(chunk));
			res.on("end", () => {
				const text = Buffer.concat(chunks).toString("utf-8");
				if (res.statusCode && res.statusCode >= 400) {
					reject(new Error(`transcription service responded ${res.statusCode}: ${text}`));
				} else {
					try {
						resolve(JSON.parse(text));
					} catch {
						reject(new Error(`non-JSON response from transcription service: ${text.slice(0, 200)}`));
					}
				}
			});
		});

		const timer = setTimeout(() => {
			req.destroy(new Error(`transcription timed out after ${timeoutMs / 60000} minutes`));
		}, timeoutMs);

		req.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		req.on("close", () => clearTimeout(timer));

		req.write(body);
		req.end();
	});
}

async function transcribeOne(id: string) {
	const audio = getRecordingForTranscription(id);
	if (!audio) return;

	try {
		setTranscriptStatus(id, "processing");
		const buffer = Buffer.from(await Bun.file(audio.path).arrayBuffer());
		const filename = audio.path.split("/").pop() ?? "audio";

		const body = await postMultipart(
			`${TRANSCRIPTION_URL}/transcribe`,
			{ model: getSettings().transcriptionModel },
			{ name: filename, data: buffer, mimeType: audio.mimeType },
			30 * 60 * 1000  // 30-minute hard limit
		) as { text?: unknown };

		const text = typeof body.text === "string" ? body.text.trim() : "";
		if (!text) throw new Error("transcription service returned no text");

		setTranscriptResult(id, text);
	} catch (err) {
		console.error(`Transcription failed for recording ${id}:`, err);
		setTranscriptStatus(id, "failed");
	}
}
