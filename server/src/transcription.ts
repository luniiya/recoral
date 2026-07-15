import {
	getRecordingForTranscription,
	listStuckTranscriptions,
	listUntranscribed,
	setTranscriptResult,
	setTranscriptStatus
} from "./recordings";
import { getSettings } from "./settings";

// The transcription service is its own Docker Compose service (whisper.cpp
// + ROCm/HIP, see transcription/), reachable over the internal compose
// network under its service name. Overridable for local dev without Docker.
const TRANSCRIPTION_URL = process.env.TRANSCRIPTION_URL ?? "http://transcription:8090";

// A GPU is a single-consumer resource, so this queue processes one recording
// at a time rather than firing off concurrent requests the service would
// just have to serialize on its end anyway.
const queue: string[] = [];
let processing = false;

export function enqueueTranscription(recordingId: string) {
	if (!getSettings().transcriptionEnabled) return;
	if (queue.includes(recordingId)) return;
	setTranscriptStatus(recordingId, "pending");
	queue.push(recordingId);
	void processQueue();
}

// Recordings still marked pending/processing when the server last shut down
// (crash, restart) need requeuing on boot, otherwise they're stuck showing
// "transcribing…" forever with nothing actually working on them.
export function requeueStuckTranscriptions() {
	if (!getSettings().transcriptionEnabled) return;
	for (const id of listStuckTranscriptions()) {
		if (!queue.includes(id)) queue.push(id);
	}
	void processQueue();
}

// Sweeps every recording that's never been transcribed successfully (never
// ran at all, or a past attempt failed) and enqueues it. Called on boot and
// whenever the admin settings are saved with transcription on, so recordings
// that predate the feature (or were created while it was off) still
// eventually get picked up automatically, not just newly-created ones.
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
			await transcribeOne(id);
		}
	} finally {
		processing = false;
	}
}

async function transcribeOne(id: string) {
	const audio = getRecordingForTranscription(id);
	if (!audio) return;

	setTranscriptStatus(id, "processing");
	try {
		const form = new FormData();
		form.append("file", Bun.file(audio.path), audio.path.split("/").pop() ?? "audio");
		form.append("model", getSettings().transcriptionModel);

		const res = await fetch(`${TRANSCRIPTION_URL}/transcribe`, { method: "POST", body: form });
		if (!res.ok) throw new Error(`transcription service responded ${res.status}: ${await res.text()}`);

		const body = (await res.json()) as { text?: unknown };
		const text = typeof body.text === "string" ? body.text.trim() : "";
		if (!text) throw new Error("transcription service returned no text");

		setTranscriptResult(id, text);
	} catch (err) {
		console.error(`Transcription failed for recording ${id}:`, err);
		setTranscriptStatus(id, "failed");
	}
}
