import { Filesystem } from '@capacitor/filesystem';
import { RecoralRecorder } from './nativeRecorder';
import { isNativePlatform } from './platform';
import { recordingsStore } from './recordings.svelte';

function base64ToBlob(base64: string, mimeType: string): Blob {
	const byteChars = atob(base64);
	const byteNumbers = new Array(byteChars.length);
	for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
	return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// Shared so both the desktop record button (on the Recordings page itself)
// and the mobile floating record button (in the layout, next to the search
// bar) drive the exact same in-progress recording, not two separate ones.
let isRecording = $state(false);
let elapsedSeconds = $state(0);
let recordingStream = $state<MediaStream | null>(null);
// Native has no raw MediaStream to analyse client-side (the native plugin
// owns the mic), so the live waveform is driven by this instead, updated by
// polling the plugin's getCurrentAmplitude() while recording.
let nativeAmplitude = $state(0);
let savingRecording = $state(false);
let lastRecordingId = $state<string | null>(null);
// Typeable while still recording (mirrors the detail panel's own fields),
// applied to the recording the moment it actually saves.
let title = $state('');
let description = $state('');

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerHandle: ReturnType<typeof setInterval> | null = null;
let amplitudeHandle: ReturnType<typeof setInterval> | null = null;
let recordingStart = 0;

async function start() {
	if (isNativePlatform()) return startNative();
	return startWeb();
}

async function startWeb() {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	recordingStream = stream;
	chunks = [];
	title = '';
	description = '';
	mediaRecorder = new MediaRecorder(stream);

	mediaRecorder.ondataavailable = (event) => {
		if (event.data.size > 0) chunks.push(event.data);
	};

	mediaRecorder.onstop = async () => {
		const blob = new Blob(chunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' });
		const durationSeconds = (Date.now() - recordingStart) / 1000;

		for (const track of stream.getTracks()) track.stop();
		recordingStream = null;
		savingRecording = true;

		const recording = await recordingsStore.addRecording(blob, title, durationSeconds, description);

		savingRecording = false;
		lastRecordingId = recording?.id ?? null;
	};

	recordingStart = Date.now();
	mediaRecorder.start();
	isRecording = true;
	elapsedSeconds = 0;
	timerHandle = setInterval(() => {
		elapsedSeconds = (Date.now() - recordingStart) / 1000;
	}, 200);
}

async function startNative() {
	title = '';
	description = '';
	await RecoralRecorder.startRecording();

	recordingStart = Date.now();
	isRecording = true;
	elapsedSeconds = 0;
	timerHandle = setInterval(() => {
		elapsedSeconds = (Date.now() - recordingStart) / 1000;
	}, 200);
	amplitudeHandle = setInterval(async () => {
		const { value } = await RecoralRecorder.getCurrentAmplitude();
		nativeAmplitude = value;
	}, 100);
}

async function stop() {
	// Guards against a second tap reaching native while the first stop is
	// still in flight (native correctly rejects it with "No active recording
	// to stop", but with nothing to catch that it'd surface as an unhandled
	// rejection instead of just being a harmless no-op).
	if (!isRecording) return;
	if (isNativePlatform()) return stopNative();
	return stopWeb();
}

function stopWeb() {
	mediaRecorder?.stop();
	isRecording = false;
	if (timerHandle) clearInterval(timerHandle);
}

async function stopNative() {
	isRecording = false;
	if (timerHandle) clearInterval(timerHandle);
	if (amplitudeHandle) clearInterval(amplitudeHandle);
	nativeAmplitude = 0;
	savingRecording = true;

	try {
		const { uri, duration } = await RecoralRecorder.stopRecording();
		// fetch(Capacitor.convertFileSrc(uri)) is the usual trick for this, but
		// hangs indefinitely (no error, no timeout) for files under this app's
		// own internal storage on this WebView version, confirmed via adb logs
		// showing the local request handler start and never complete. Reading
		// the file directly through the Filesystem plugin instead is the
		// standard, well-tested Capacitor path and doesn't have that problem.
		const { data } = await Filesystem.readFile({ path: uri });
		const blob = base64ToBlob(data as string, 'audio/mp4');
		const durationSeconds = duration / 1000;

		const recording = await recordingsStore.addRecording(blob, title, durationSeconds, description);
		lastRecordingId = recording?.id ?? null;
	} catch (err) {
		// Surfaced so a real failure here is visible instead of leaving the
		// panel stuck on "Saving..." forever with no explanation.
		console.error('[liveRecording] Failed to save native recording:', err);
	} finally {
		savingRecording = false;
	}
}

function toggle() {
	if (isRecording) stop();
	else start();
}

function setTitle(next: string) {
	title = next;
}

function setDescription(next: string) {
	description = next;
}

// The Recordings page selects the newly-saved recording once it lands;
// consuming resets it so the same id can't get re-selected on a later visit.
function consumeLastRecordingId() {
	const id = lastRecordingId;
	lastRecordingId = null;
	return id;
}

export const liveRecordingStore = {
	get isRecording() {
		return isRecording;
	},
	get elapsedSeconds() {
		return elapsedSeconds;
	},
	get recordingStream() {
		return recordingStream;
	},
	get nativeAmplitude() {
		return nativeAmplitude;
	},
	get savingRecording() {
		return savingRecording;
	},
	get lastRecordingId() {
		return lastRecordingId;
	},
	get title() {
		return title;
	},
	get description() {
		return description;
	},
	start,
	stop,
	toggle,
	setTitle,
	setDescription,
	consumeLastRecordingId
};
