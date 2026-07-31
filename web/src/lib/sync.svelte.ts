import { Filesystem } from '@capacitor/filesystem';
import { base64ToBlob } from './base64';
import { outboxStore } from './outbox.svelte';
import { isNativePlatform } from './platform';
import { recordingsStore } from './recordings.svelte';

// Pushes whatever's in the local outbox to the server, one item at a time,
// oldest first. Stops the whole pass on the first real failure (network
// failure or a server rejection like quota) rather than hammering through the
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
				if (!recording) {
					// A 409 (content hash already matches something on the server)
					// isn't a real failure to retry later, the content is already
					// safely up there, just under a different recording id, e.g.
					// this same file got uploaded on a previous flush and only the
					// outbox-clearing step never happened. Reconcile to the
					// existing recording and keep going instead of breaking the
					// whole pass here forever: without this, this one stuck item
					// re-fails on every single future flush (each one starting
					// from the front of the queue again) and permanently blocks
					// every real recording queued behind it too.
					const duplicate = recordingsStore.lastDuplicate;
					if (duplicate) {
						// Silently resolved, not a real error from this background
						// flush's point of view (the recording IS safely on the
						// server), so don't leave the "X is already in your
						// library" banner up for something the user never
						// actually did anything wrong in.
						recordingsStore.dismissImportError();
						await outboxStore.markSynced(item.localId, duplicate.id, item.filePath);
						continue;
					}
					break;
				}
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
