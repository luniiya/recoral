import type { Recording } from '@recoral/shared';

const TRASH_RETENTION_DAYS = 30;

let all = $state<Recording[]>([]);
let loaded = $state(false);
let search = $state('');
let selectedTagIds = $state<string[]>([]);
let importError = $state<string | null>(null);

let active = $derived(all.filter((r) => r.trashedAt === null && r.archivedAt === null));
let archived = $derived(all.filter((r) => r.trashedAt === null && r.archivedAt !== null));
let trashed = $derived(all.filter((r) => r.trashedAt !== null));
let favorites = $derived(all.filter((r) => r.trashedAt === null && r.favorite));

function audioUrl(id: string) {
	return `/api/recordings/${id}/audio`;
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
	const res = await fetch('/api/recordings', { credentials: 'include' });
	if (res.ok) all = await res.json();
	loaded = true;
}

async function upload(file: File | Blob, filename: string, title: string, durationSeconds: number) {
	const form = new FormData();
	form.append('file', file, filename);
	form.append('title', title);
	form.append('durationSeconds', String(durationSeconds));

	const res = await fetch('/api/recordings', { method: 'POST', credentials: 'include', body: form });

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
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

async function addRecording(blob: Blob, title: string, durationSeconds: number): Promise<Recording | null> {
	const result = await upload(blob, 'recording.webm', title, durationSeconds);
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
	const res = await fetch(`/api/recordings/${id}`, {
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
	patch(id, { title });
}

function updateDescription(id: string, description: string) {
	patch(id, { description });
}

function toggleFavorite(id: string) {
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
	all = all.filter((r) => r.id !== id);
	await fetch(`/api/recordings/${id}`, { method: 'DELETE', credentials: 'include' });
}

async function toggleRecordingTag(recordingId: string, tagId: string) {
	const recording = all.find((r) => r.id === recordingId);
	if (!recording) return;
	const has = recording.tagIds.includes(tagId);
	recording.tagIds = has ? recording.tagIds.filter((id) => id !== tagId) : [...recording.tagIds, tagId];
	await fetch(`/api/recordings/${recordingId}/tags/${tagId}`, {
		method: has ? 'DELETE' : 'POST',
		credentials: 'include'
	});
}

function toggleFilterTag(tagId: string) {
	selectedTagIds = selectedTagIds.includes(tagId)
		? selectedTagIds.filter((id) => id !== tagId)
		: [...selectedTagIds, tagId];
}

function clearFilters() {
	selectedTagIds = [];
}

function setSearch(value: string) {
	search = value;
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
	get selectedTagIds() {
		return selectedTagIds;
	},
	get importError() {
		return importError;
	},
	get loaded() {
		return loaded;
	},
	audioUrl,
	load,
	importFiles,
	addRecording,
	dismissImportError,
	updateTitle,
	updateDescription,
	toggleRecordingTag,
	toggleFilterTag,
	clearFilters,
	setSearch,
	toggleFavorite,
	archive,
	unarchive,
	trash,
	restore,
	deleteForever,
	daysLeft,
	taggedCount
};
