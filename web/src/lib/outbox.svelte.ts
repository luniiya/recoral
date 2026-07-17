import { Preferences } from '@capacitor/preferences';

// Local-first recording queue (mobile only): a recording made offline (or
// where the immediate upload attempt fails) is never lost, it's saved here
// first and retried whenever the app can reach the server. The audio file
// itself already lives in the native recorder's own persistent storage
// (RecorderService writes to getFilesDir(), not cache), this just tracks the
// metadata needed to upload it later and to show it in the list meanwhile.
export interface PendingRecording {
	localId: string;
	filePath: string;
	mimeType: string;
	title: string;
	description: string;
	durationSeconds: number;
	createdAt: string;
}

const PENDING_KEY = 'recoral_outbox';
const LOCAL_FILES_KEY = 'recoral_local_files';

let pending = $state<PendingRecording[]>([]);
// The pending item actively being pushed right now, if any: drives a
// pulsing ring around that one card so uploading is visible, not just a
// silent icon flip once it's done. Not persisted, purely a live UI cue.
let uploadingId = $state<string | null>(null);
// Registry of "this server recording also has a playable file on this
// device", keyed by the real server id. Populated two ways: automatically
// once a recording made on this device finishes syncing (still local, just
// no longer only local), or explicitly via downloadForOffline(). Used to
// prefer local playback over a network request, and to show the
// cloud+checkmark ("both") icon instead of plain cloud ("server only").
let localFiles = $state<Record<string, string>>({});
let loaded = false;
// Set every time a pending item's id resolves to a real server id, so a page
// holding onto the old local id (e.g. the just-opened RecordingDetail panel
// for a recording still mid-upload) can follow it instead of losing track of
// the recording once it's no longer in `pending` under the old id.
let lastRemap = $state<{ from: string; to: string } | null>(null);

async function persist() {
	await Promise.all([
		Preferences.set({ key: PENDING_KEY, value: JSON.stringify(pending) }),
		Preferences.set({ key: LOCAL_FILES_KEY, value: JSON.stringify(localFiles) })
	]);
}

async function init() {
	if (loaded) return;
	loaded = true;
	const [pendingRes, localFilesRes] = await Promise.all([
		Preferences.get({ key: PENDING_KEY }),
		Preferences.get({ key: LOCAL_FILES_KEY })
	]);
	if (pendingRes.value) {
		try {
			pending = JSON.parse(pendingRes.value);
		} catch {
			pending = [];
		}
	}
	if (localFilesRes.value) {
		try {
			localFiles = JSON.parse(localFilesRes.value);
		} catch {
			localFiles = {};
		}
	}
}

async function add(entry: Omit<PendingRecording, 'localId'>): Promise<PendingRecording> {
	const item: PendingRecording = { ...entry, localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
	pending = [item, ...pending];
	await persist();
	return item;
}

async function remove(localId: string) {
	pending = pending.filter((p) => p.localId !== localId);
	await persist();
}

function updateMeta(localId: string, updates: Partial<Pick<PendingRecording, 'title' | 'description'>>) {
	pending = pending.map((p) => (p.localId === localId ? { ...p, ...updates } : p));
	void persist();
}

function setUploading(localId: string | null) {
	uploadingId = localId;
}

// A pending item just finished uploading successfully: it's no longer
// unsynced, but the on-device file it was recorded to is still sitting
// right there, so it becomes a "both" (local-and-synced) entry under its
// real server id instead of just disappearing from local storage.
async function markSynced(localId: string, serverId: string, filePath: string) {
	pending = pending.filter((p) => p.localId !== localId);
	localFiles = { ...localFiles, [serverId]: filePath };
	lastRemap = { from: localId, to: serverId };
	await persist();
}

function cacheLocalFile(serverId: string, filePath: string) {
	localFiles = { ...localFiles, [serverId]: filePath };
	void persist();
}

function removeLocalFile(serverId: string) {
	if (!(serverId in localFiles)) return;
	const next = { ...localFiles };
	delete next[serverId];
	localFiles = next;
	void persist();
}

export const outboxStore = {
	get pending() {
		return pending;
	},
	get localFiles() {
		return localFiles;
	},
	get uploadingId() {
		return uploadingId;
	},
	get lastRemap() {
		return lastRemap;
	},
	init,
	add,
	remove,
	updateMeta,
	markSynced,
	cacheLocalFile,
	removeLocalFile,
	setUploading
};
