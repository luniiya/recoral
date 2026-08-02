import type { Recording } from '@recoral/shared';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { api } from './api.svelte';
import { bulkJobStore } from './bulkJob.svelte';
import { readLocalCache, writeLocalCache } from './localCache';
import { outboxStore } from './outbox.svelte';
import type { SearchFields } from './recordingFilter';
import { ancestorTagIds } from './tagPath';
import { tagsStore } from './tags.svelte';

const TRASH_RETENTION_DAYS = 30;

// Mobile only. 'local': still in the outbox, not on the server at all yet
// (device-only icon). 'uploading': actively being pushed right now (pulsing
// ring on its card). 'local-and-synced': on the server AND this device still
// has a playable local copy (cloud+check icon). Anything without this field
// is server-only, no local copy on this device (plain cloud icon).
export interface DisplayRecording extends Recording {
	syncStatus?: 'local' | 'uploading' | 'local-and-synced';
}

function isLocalId(id: string) {
	return id.startsWith('local-');
}

function withSyncStatus(r: Recording): DisplayRecording {
	return outboxStore.localFiles[r.id] ? { ...r, syncStatus: 'local-and-synced' } : r;
}

const CACHED_RECORDINGS_KEY = 'recoral_cached_recordings';

let all = $state<Recording[]>(readLocalCache<Recording[]>(CACHED_RECORDINGS_KEY, []));
let loaded = $state(false);
let search = $state('');
// Which fields count as a match, toggleable in the filter panel. Transcript
// defaults off (a transcript is a big loose blob of text, a hit there is
// less "intentional" than a title/description match), title/description
// default on.
let searchFields = $state<SearchFields>({ title: true, description: true, transcript: false });
// Ids the server confirmed match the current `search` + `searchFields`
// combination, once it answers, or null if there's no server answer yet for
// that exact combination (still debouncing, in flight, offline, or timed
// out). See recordingFilter.ts's matchesSearch(): the local substring match
// (already covering title/description/transcript, the whole library is
// always loaded client-side today) is what's shown instantly and what's used
// whenever this is null, this is purely a reconcile-when-available layer on
// top, forward-looking for whenever search needs to cover data the client
// doesn't have loaded, see TODO.md.
let serverSearchIds = $state<string[] | null>(null);
let serverSearchKey = $state<string | null>(null);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function searchKey(query: string, fields: SearchFields): string {
	return `${query}|${fields.title ? 1 : 0}|${fields.description ? 1 : 0}|${fields.transcript ? 1 : 0}`;
}
let selectedTagIds = $state<string[]>([]);
// yyyy-mm-dd (native <input type="date"> format), inclusive on both ends,
// either end can be open (null) for a one-sided range. Combines with
// selectedTagIds and search as an AND, same as they combine with each other,
// see recordingFilter.ts.
let dateFrom = $state<string | null>(null);
let dateTo = $state<string | null>(null);
let importError = $state<string | null>(null);
// Set whenever upload() gets a 409 (content-hash match against an existing
// recording), alongside importError, so a caller that specifically cares
// about *which* recording it's a duplicate of (the outbox flush, to
// reconcile a stuck local file to the one already on the server instead of
// retrying it forever, see sync.svelte.ts) can read it right after a failed
// addRecording() call. Reset at the top of every upload() so a stale value
// from a previous item's duplicate can't leak onto a later, unrelated failure.
let lastDuplicate = $state<Recording | null>(null);

function pendingAsRecordings(): DisplayRecording[] {
	return outboxStore.pending.map((p) => ({
		id: p.localId,
		title: p.title,
		description: p.description,
		createdAt: p.createdAt,
		durationSeconds: p.durationSeconds,
		transcript: null,
		transcriptStatus: 'none',
		favorite: false,
		archivedAt: null,
		trashedAt: null,
		tagIds: [],
		syncStatus: p.localId === outboxStore.uploadingId ? 'uploading' : 'local'
	}));
}

let active = $derived<DisplayRecording[]>([
	...pendingAsRecordings(),
	...all.filter((r) => r.trashedAt === null && r.archivedAt === null).map(withSyncStatus)
]);
let archived = $derived(all.filter((r) => r.trashedAt === null && r.archivedAt !== null).map(withSyncStatus));
let trashed = $derived(all.filter((r) => r.trashedAt !== null).map(withSyncStatus));
let favorites = $derived(all.filter((r) => r.trashedAt === null && r.favorite).map(withSyncStatus));

function audioUrl(id: string) {
	// Not uploaded yet, or on the server but this device also still has the
	// file (either it was recorded here, or explicitly downloaded for
	// offline use): play straight from that local file rather than the
	// network. Capacitor.convertFileSrc() (not fetch(), which hangs
	// indefinitely for this app's own internal storage on this WebView, see
	// liveRecording.svelte.ts) is the standard way to hand a native file to
	// an <audio>/<video> element. Preferring it even when online avoids an
	// unnecessary network request and guarantees offline playback works.
	const pendingItem = outboxStore.pending.find((p) => p.localId === id);
	if (pendingItem) return Capacitor.convertFileSrc(pendingItem.filePath);
	const localPath = outboxStore.localFiles[id];
	if (localPath) return Capacitor.convertFileSrc(localPath);

	// <audio src> loads directly, with no way to attach an Authorization
	// header, so the token (when auth is token-based, i.e. mobile) has to
	// ride along as a query param instead.
	const path = `/api/recordings/${id}/audio`;
	return api.token ? api.url(`${path}?token=${encodeURIComponent(api.token)}`) : api.url(path);
}

// The actual on-device file path for a recording, if it has one (still
// pending upload, or synced-with-local-copy, or explicitly downloaded).
// Native only, used for sharing an actual file rather than a URL (which
// would need to embed the bearer token, leaking it to whoever it's shared
// with) and for showing "already downloaded" state in the detail panel.
function localFilePath(id: string): string | null {
	const pendingItem = outboxStore.pending.find((p) => p.localId === id);
	if (pendingItem) return pendingItem.filePath;
	return outboxStore.localFiles[id] ?? null;
}

// Mobile only: fetches the audio from the server once and writes it to the
// app's own internal storage, so it plays back with no network afterwards
// (audioUrl() above then prefers this local copy automatically).
async function downloadForOffline(id: string): Promise<void> {
	// api.fetch() already resolves the path against the base URL and attaches
	// the Authorization header itself (it's a real fetch() call, unlike
	// <audio src> which can't attach headers, hence that path's ?token= trick
	// in audioUrl() above). Passing an already-absolute URL in here would
	// double up the base URL on top of itself.
	const res = await api.fetch(`/api/recordings/${id}/audio`);
	if (!res.ok) throw new Error('Failed to download recording');
	const blob = await res.blob();
	const base64 = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
	const ext = blob.type.split('/')[1]?.split(';')[0] || 'bin';
	const { uri } = await Filesystem.writeFile({
		path: `recordings/downloaded-${id}.${ext}`,
		data: base64,
		directory: Directory.Data,
		recursive: true
	});
	outboxStore.cacheLocalFile(id, uri);
}

function stripExtension(filename: string) {
	return filename.replace(/\.[^./]+$/, '');
}

function readDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio(url);
		audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 0));
		audio.addEventListener('error', () => resolve(0));
	});
}

async function load() {
	try {
		// Bounded, see tags.svelte.ts's load() / auth.svelte.ts's refresh() for
		// why: an unreachable server otherwise leaves this hanging for however
		// long the OS network stack takes to give up on its own.
		const res = await api.fetch('/api/recordings', { credentials: 'include', signal: AbortSignal.timeout(8000) });
		if (res.ok) {
			all = await res.json();
			writeLocalCache(CACHED_RECORDINGS_KEY, all);
		}
	} catch {
		// Offline: keep showing whatever was cached from the last successful load.
	} finally {
		loaded = true;
	}
}

async function upload(
	file: File | Blob,
	filename: string,
	title: string,
	durationSeconds: number,
	description?: string
) {
	const form = new FormData();
	form.append('file', file, filename);
	form.append('title', title);
	form.append('durationSeconds', String(durationSeconds));
	if (description) form.append('description', description);

	lastDuplicate = null;
	const res = await api.fetch('/api/recordings', { method: 'POST', credentials: 'include', body: form });

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		if (res.status === 409 && body.existing) lastDuplicate = body.existing as Recording;
		return { error: (body.error as string) ?? 'Something went wrong' };
	}

	const recording: Recording = await res.json();
	all = [recording, ...all];
	return { recording };
}

async function importFiles(files: FileList | File[]) {
	const errors: string[] = [];

	for (const file of Array.from(files)) {
		if (!file.type.startsWith('audio/')) continue;

		const objectUrl = URL.createObjectURL(file);
		const durationSeconds = await readDuration(objectUrl);
		URL.revokeObjectURL(objectUrl);

		const result = await upload(file, file.name, stripExtension(file.name), durationSeconds);
		if (result.error) errors.push(result.error);
	}

	if (errors.length > 0) {
		importError = errors.length === 1 ? errors[0] : `${errors.length} files weren't imported`;
	}
}

async function addRecording(
	blob: Blob,
	title: string,
	durationSeconds: number,
	description?: string
): Promise<Recording | null> {
	// Filename extension matters server-side (extensionFor() in recordings.ts
	// prefers it over the blob's own MIME type), so a hardcoded .webm here
	// would mislabel native recordings, which are real .m4a/AAC content.
	// `audio/mp4` (what the native recorder's blob is tagged as, see
	// liveRecording.svelte.ts) maps to `.m4a` specifically, not the literal
	// `.mp4` MIME subtype: it's audio-only MPEG-4/AAC content, the same file
	// the native side already saved on-device with a `.m4a` name, `.mp4`
	// conventionally implies a video-capable container even though the box
	// format is technically identical.
	const mimeSubtype = blob.type.split('/')[1]?.split(';')[0];
	const ext = mimeSubtype === 'mp4' ? 'm4a' : mimeSubtype || 'webm';
	const result = await upload(blob, `recording.${ext}`, title, durationSeconds, description);
	if (result.error) {
		importError = result.error;
		return null;
	}
	return result.recording ?? null;
}

function dismissImportError() {
	importError = null;
}

async function patch(
	id: string,
	updates: Partial<{ title: string; description: string; favorite: boolean; archived: boolean; trashed: boolean }>
) {
	// Favorite/archive/trash need a recording that actually exists server-side.
	// Title/description on a still-local one are handled by their own
	// functions below before ever reaching here.
	if (isLocalId(id)) return;
	const res = await api.fetch(`/api/recordings/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(updates)
	});
	if (res.ok) {
		const updated: Recording = await res.json();
		all = all.map((r) => (r.id === id ? updated : r));
	}
}

function updateTitle(id: string, title: string) {
	if (isLocalId(id)) return outboxStore.updateMeta(id, { title });
	patch(id, { title });
}

function updateDescription(id: string, description: string) {
	if (isLocalId(id)) return outboxStore.updateMeta(id, { description });
	patch(id, { description });
}

function toggleFavorite(id: string) {
	if (isLocalId(id)) return;
	const recording = all.find((r) => r.id === id);
	if (recording) patch(id, { favorite: !recording.favorite });
}

function archive(id: string) {
	patch(id, { archived: true });
}

function unarchive(id: string) {
	patch(id, { archived: false });
}

function trash(id: string) {
	patch(id, { trashed: true });
}

function restore(id: string) {
	patch(id, { trashed: false });
}

async function deleteForever(id: string) {
	if (isLocalId(id)) {
		await outboxStore.remove(id);
		return;
	}
	const localPath = outboxStore.localFiles[id];
	if (localPath) {
		outboxStore.removeLocalFile(id);
		try {
			await Filesystem.deleteFile({ path: localPath });
		} catch {
			// already gone, nothing to clean up
		}
	}
	all = all.filter((r) => r.id !== id);
	await api.fetch(`/api/recordings/${id}`, { method: 'DELETE', credentials: 'include' });
}

// Bin's own bulk restore/delete-forever (a selected subset of already-
// trashed recordings, not "everything", that's Empty Bin's own dedicated
// /api/bin endpoint instead): same batched-job treatment as trashMany etc.
// below, one request instead of one per selected recording.
function restoreMany(ids: string[]) {
	void bulkJobStore.start('restore', '/api/recordings/bulk', { ids, trashed: false }, ids.length, load);
}

function deleteManyForever(ids: string[]) {
	void bulkJobStore.start('delete', '/api/recordings/bulk-delete', { ids }, ids.length, load);
}

// Bulk delete from multi-select: local-only recordings have no bin to go to
// (never uploaded, same reasoning as the single-recording delete button in
// RecordingDetail), everything else is a real server-side batch job, not
// this client looping trash() once per id (confirmed a real problem at
// real scale: a selection of hundreds/thousands of recordings meant
// hundreds/thousands of individual PATCH requests piling up, some measured
// taking 3+ seconds to resolve once queued behind each other), see
// bulkJob.svelte.ts and server/src/bulkJobs.ts.
function trashMany(ids: string[]) {
	const localIds = ids.filter(isLocalId);
	const remoteIds = ids.filter((id) => !isLocalId(id));
	for (const id of localIds) void deleteForever(id);
	void bulkJobStore.start('trash', '/api/recordings/bulk', { ids: remoteIds, trashed: true }, remoteIds.length, load);
}

// Bulk archive/favourite from multi-select: always sets the target state
// rather than toggling, same reasoning as addTagToMany below, some selected
// recordings may already be archived/favourited and a toggle would
// incorrectly flip those back off. Local-only (never-uploaded) recordings
// have no server row to patch yet, same as trashMany above.
function archiveMany(ids: string[]) {
	const remoteIds = ids.filter((id) => !isLocalId(id));
	void bulkJobStore.start('archive', '/api/recordings/bulk', { ids: remoteIds, archived: true }, remoteIds.length, load);
}

function favoriteMany(ids: string[]) {
	const remoteIds = ids.filter((id) => !isLocalId(id));
	void bulkJobStore.start('favorite', '/api/recordings/bulk', { ids: remoteIds, favorite: true }, remoteIds.length, load);
}

// Adding a tag also adds all of its ancestor tags as real membership (not
// just something the filter panel cascades at query time), so a recording
// tagged only with "voiceacting/certainvoice" genuinely belongs to
// "voiceacting" too everywhere tagIds gets checked directly, e.g. exports.
// Removing a tag never removes ancestors, a deliberate one-way rule with no
// reference-counting against sibling subtags, see toggleRecordingTag.
async function addTagWithAncestors(recording: Recording, tagId: string) {
	const tag = tagsStore.list.find((t) => t.id === tagId);
	const missing = (tag ? ancestorTagIds(tag, tagsStore.list) : []).filter((id) => !recording.tagIds.includes(id));
	const newIds = [...missing, tagId];
	recording.tagIds = [...recording.tagIds, ...newIds];
	await Promise.all(
		newIds.map((id) =>
			api.fetch(`/api/recordings/${recording.id}/tags/${id}`, { method: 'POST', credentials: 'include' })
		)
	);
}

// Bulk-add from multi-select's "+ tag": always adds, never removes, unlike
// toggleRecordingTag, since some selected recordings may already carry the
// tag and a toggle would incorrectly strip it back off those. The ancestor
// set only depends on the one target tag, not on which recording is being
// tagged, so it's computed once here and sent as a flat tagIds list to the
// bulk endpoint, real server-side batching instead of this client looping
// one (or, per recording, several, one per ancestor) requests itself.
function addTagToMany(ids: string[], tagId: string) {
	const tag = tagsStore.list.find((t) => t.id === tagId);
	const tagIds = [...(tag ? ancestorTagIds(tag, tagsStore.list) : []), tagId];
	const remoteIds = ids.filter((id) => !isLocalId(id));
	void bulkJobStore.start('addTag', '/api/recordings/bulk-tag', { ids: remoteIds, tagIds }, remoteIds.length, load);
}

async function toggleRecordingTag(recordingId: string, tagId: string) {
	if (isLocalId(recordingId)) return;
	const recording = all.find((r) => r.id === recordingId);
	if (!recording) return;
	if (recording.tagIds.includes(tagId)) {
		recording.tagIds = recording.tagIds.filter((id) => id !== tagId);
		await api.fetch(`/api/recordings/${recordingId}/tags/${tagId}`, { method: 'DELETE', credentials: 'include' });
		return;
	}
	await addTagWithAncestors(recording, tagId);
}

// Used to poll a single recording while its transcript is pending/processing
// (see RecordingDetail.svelte), rather than re-fetching the whole list.
async function refreshOne(id: string) {
	if (isLocalId(id)) return;
	const res = await api.fetch(`/api/recordings/${id}`, { credentials: 'include' });
	if (!res.ok) return;
	const updated: Recording = await res.json();
	all = all.map((r) => (r.id === id ? updated : r));
}

async function retryTranscription(id: string): Promise<{ error?: string }> {
	if (isLocalId(id)) return {};
	const res = await api.fetch(`/api/recordings/${id}/transcribe`, { method: 'POST', credentials: 'include' });
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		return { error: (body.error as string) ?? 'Something went wrong' };
	}
	all = all.map((r) => (r.id === id ? { ...r, transcriptStatus: 'pending' } : r));
	return {};
}

function toggleFilterTag(tagId: string) {
	selectedTagIds = selectedTagIds.includes(tagId)
		? selectedTagIds.filter((id) => id !== tagId)
		: [...selectedTagIds, tagId];
}

// Used by the filter panel to select/deselect a tag together with all of its
// subtags in one click (ids computed by the caller via tagPath.ts's
// subtagIds()). Adds every id if any are missing, so a partially-selected
// subtree becomes fully selected in one click rather than toggling into a
// confusing mixed state; only removes them all once every one is already
// selected.
function toggleFilterTagGroup(ids: string[]) {
	const allSelected = ids.every((id) => selectedTagIds.includes(id));
	selectedTagIds = allSelected
		? selectedTagIds.filter((id) => !ids.includes(id))
		: [...new Set([...selectedTagIds, ...ids])];
}

function setDateRange(from: string | null, to: string | null) {
	dateFrom = from;
	dateTo = to;
}

function clearFilters() {
	selectedTagIds = [];
	dateFrom = null;
	dateTo = null;
}

// Tapping a tag chip on a recording (RecordingDetail) to browse everything
// with that tag: an exclusive filter, not additive like toggleFilterTag
// (used by the Tags page's own multi-select chips), since "search this tag"
// reads as a fresh lookup, not "also include this one too".
function setTagFilter(tagId: string) {
	selectedTagIds = [tagId];
}

// Debounced so typing doesn't fire a request per keystroke; the local
// substring match (recordingFilter.ts) already shows instant results the
// whole time this is in flight, so there's no rush.
const SEARCH_DEBOUNCE_MS = 300;

async function searchServer(query: string, fields: SearchFields) {
	try {
		const params = new URLSearchParams({
			q: query,
			title: fields.title ? '1' : '0',
			description: fields.description ? '1' : '0',
			transcript: fields.transcript ? '1' : '0'
		});
		const res = await api.fetch(`/api/recordings/search?${params}`, {
			credentials: 'include',
			signal: AbortSignal.timeout(8000)
		});
		if (!res.ok) return;
		const results: Recording[] = await res.json();
		// The query or field toggles could've changed again while this was in
		// flight; only apply it if it's still the exact combination currently
		// active.
		if (searchKey(query, fields) !== searchKey(search.trim().toLowerCase(), searchFields)) return;
		serverSearchIds = results.map((r) => r.id);
		serverSearchKey = searchKey(query, fields);
	} catch {
		// Offline or timed out: nothing to do, the local match already covers
		// this today (see the comment on serverSearchIds above), so no error
		// state is needed here.
	}
}

function setSearch(value: string) {
	search = value;
	if (searchDebounce) clearTimeout(searchDebounce);
	const query = value.trim().toLowerCase();
	if (!query) {
		serverSearchIds = null;
		serverSearchKey = null;
		return;
	}
	searchDebounce = setTimeout(() => searchServer(query, searchFields), SEARCH_DEBOUNCE_MS);
}

// Toggling a search field is a discrete click, not rapid typing, so this
// fires immediately rather than debouncing like setSearch above.
function setSearchFields(fields: SearchFields) {
	searchFields = fields;
	if (searchDebounce) clearTimeout(searchDebounce);
	const query = search.trim().toLowerCase();
	if (!query) return;
	void searchServer(query, fields);
}

function daysLeft(recording: Recording) {
	if (!recording.trashedAt) return null;
	const elapsedDays = (Date.now() - new Date(recording.trashedAt).getTime()) / (1000 * 60 * 60 * 24);
	return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
}

// Non-trashed recordings only, so a tag's count reflects what's actually
// browsable right now, not recordings sitting in the bin. Accepts multiple
// tag ids so a parent tag's count can include its subtags without
// double-counting a recording that carries both.
function taggedCount(tagIds: string | string[]) {
	const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
	return all.filter((r) => r.trashedAt === null && r.tagIds.some((id) => ids.includes(id))).length;
}

export const recordingsStore = {
	get active() {
		return active;
	},
	get archived() {
		return archived;
	},
	get trashed() {
		return trashed;
	},
	get favorites() {
		return favorites;
	},
	get search() {
		return search;
	},
	get searchFields() {
		return searchFields;
	},
	// null unless the server has actually answered for this exact current
	// query + field-toggle combination (see setSearch/searchServer above), so
	// a stale answer for a query/scope the user has since changed never gets
	// applied.
	get serverSearchIds() {
		return serverSearchKey === searchKey(search.trim().toLowerCase(), searchFields) ? serverSearchIds : null;
	},
	get selectedTagIds() {
		return selectedTagIds;
	},
	get dateFrom() {
		return dateFrom;
	},
	get dateTo() {
		return dateTo;
	},
	get importError() {
		return importError;
	},
	get lastDuplicate() {
		return lastDuplicate;
	},
	get loaded() {
		return loaded;
	},
	audioUrl,
	downloadForOffline,
	localFilePath,
	load,
	importFiles,
	addRecording,
	dismissImportError,
	updateTitle,
	updateDescription,
	refreshOne,
	retryTranscription,
	toggleRecordingTag,
	toggleFilterTag,
	toggleFilterTagGroup,
	setTagFilter,
	setDateRange,
	clearFilters,
	setSearch,
	setSearchFields,
	toggleFavorite,
	archive,
	unarchive,
	trash,
	trashMany,
	archiveMany,
	favoriteMany,
	restore,
	restoreMany,
	deleteForever,
	deleteManyForever,
	addTagToMany,
	daysLeft,
	taggedCount
};
