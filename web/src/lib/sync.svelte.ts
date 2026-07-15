import { Filesystem } from '@capacitor/filesystem';
import { base64ToBlob } from './base64';
import { outboxStore } from './outbox.svelte';
import { isNativePlatform } from './platform';
import { recordingsStore } from './recordings.svelte';

// Pushes whatever's in the local outbox to the server, one item at a time,
// oldest first. Stops the whole pass on the first failure (network failure
// or a real server rejection like quota) rather than hammering through the
// rest, since a failure this early usually means the rest will fail the same
// way too, best-effort per the project's sync model, not a retry-every-item
// guarantee.
let flushing = false;

async function flush() {
	if (!isNativePlatform() || flushing) return;
	flushing = true;
	try {
		for (const item of [...outboxStore.pending].reverse()) {
			outboxStore.setUploading(item.localId);
			try {
				const { data } = await Filesystem.readFile({ path: item.filePath });
				const blob = base64ToBlob(data as string, item.mimeType);
				const recording = await recordingsStore.addRecording(
					blob,
					item.title,
					item.durationSeconds,
					item.description
				);
				if (!recording) break;
				await outboxStore.markSynced(item.localId, recording.id, item.filePath);
			} catch (err) {
				console.error('[sync] Failed to push queued recording, will retry later:', err);
				break;
			} finally {
				outboxStore.setUploading(null);
			}
		}
	} finally {
		flushing = false;
	}
}

let initialized = false;

async function init() {
	if (!isNativePlatform() || initialized) return;
	initialized = true;
	// The browser 'online' event is unreliable inside a WebView (confirmed:
	// toggling airplane mode off did not resume a stalled sync), Network
	// asks Android's own ConnectivityManager instead, which actually fires.
	const { Network } = await import('@capacitor/network');
	Network.addListener('networkStatusChange', (status) => {
		if (status.connected) void flush();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void flush();
	});
	void flush();
}

export const syncStore = { flush, init };
