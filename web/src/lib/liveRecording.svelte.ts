import { recordingsStore } from './recordings.svelte';

// Shared so both the desktop record button (on the Recordings page itself)
// and the mobile floating record button (in the layout, next to the search
// bar) drive the exact same in-progress recording, not two separate ones.
let isRecording = $state(false);
let elapsedSeconds = $state(0);
let recordingStream = $state<MediaStream | null>(null);
let savingRecording = $state(false);
let lastRecordingId = $state<string | null>(null);
// Typeable while still recording (mirrors the detail panel's own fields),
// applied to the recording the moment it actually saves.
let title = $state('');
let description = $state('');

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerHandle: ReturnType<typeof setInterval> | null = null;
let recordingStart = 0;

async function start() {
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

function stop() {
	mediaRecorder?.stop();
	isRecording = false;
	if (timerHandle) clearInterval(timerHandle);
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
