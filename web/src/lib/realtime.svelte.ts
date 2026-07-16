import { api } from './api.svelte';
import { recordingsStore } from './recordings.svelte';
import { tagsStore } from './tags.svelte';

// Cross-device live updates (recording on the phone should show up on the
// desktop webUI without a manual refresh, and vice versa): a plain
// EventSource against the server's SSE broadcast (see server/src/realtime.ts)
// rather than a WebSocket, since this only ever needs to flow one way
// (server -> "something changed, go refetch"), and EventSource gets
// reconnect-on-drop for free, unlike a WebSocket the client would have to
// manage itself.
let source: EventSource | null = null;

// A bulk import (Google Takeout, recoral export) broadcasts once per
// recording created, hundreds in a row for a real import; debouncing
// collapses a burst like that into a single refetch instead of hammering
// /api/recordings hundreds of times in a few seconds.
const DEBOUNCE_MS = 400;
let recordingsTimeout: ReturnType<typeof setTimeout> | null = null;
let tagsTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleRecordingsRefresh() {
	if (recordingsTimeout) clearTimeout(recordingsTimeout);
	recordingsTimeout = setTimeout(() => void recordingsStore.load(), DEBOUNCE_MS);
}

function scheduleTagsRefresh() {
	if (tagsTimeout) clearTimeout(tagsTimeout);
	tagsTimeout = setTimeout(() => void tagsStore.load(), DEBOUNCE_MS);
}

function connect() {
	if (source) return;
	// EventSource can't attach an Authorization header, same limitation as
	// <audio src>/<img src> (see CLAUDE.md's mobile-auth decision), so mobile's
	// cross-origin connection authenticates via the same ?token= convention.
	// Desktop is same-origin and sends its session cookie automatically.
	const url = api.token ? `${api.url('/api/events')}?token=${encodeURIComponent(api.token)}` : api.url('/api/events');
	source = new EventSource(url);
	source.onmessage = (event) => {
		let data: { type?: string };
		try {
			data = JSON.parse(event.data);
		} catch {
			return;
		}
		if (data.type === 'recordings') scheduleRecordingsRefresh();
		else if (data.type === 'tags') scheduleTagsRefresh();
	};
}

function disconnect() {
	source?.close();
	source = null;
}

export const realtimeStore = { connect, disconnect };
