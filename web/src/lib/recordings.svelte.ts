const TRASH_RETENTION_DAYS = 30;

export type LocalRecording = {
	id: string;
	title: string;
	description: string;
	url: string;
	createdAt: Date;
	durationSeconds: number;
	tagIds: string[];
	trashedAt: Date | null;
};

let all = $state<LocalRecording[]>([]);
let search = $state('');
let selectedTagIds = $state<string[]>([]);

let active = $derived(all.filter((r) => r.trashedAt === null));
let trashed = $derived(all.filter((r) => r.trashedAt !== null));

function readDuration(url: string): Promise<number> {
	return new Promise((resolve) => {
		const audio = new Audio(url);
		audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 0));
		audio.addEventListener('error', () => resolve(0));
	});
}

function stripExtension(filename: string) {
	return filename.replace(/\.[^./]+$/, '');
}

function add(entry: Omit<LocalRecording, 'id' | 'tagIds' | 'trashedAt'>) {
	all = [{ id: crypto.randomUUID(), tagIds: [], trashedAt: null, ...entry }, ...all];
}

async function importFiles(files: FileList | File[]) {
	for (const file of Array.from(files)) {
		if (!file.type.startsWith('audio/')) continue;
		const url = URL.createObjectURL(file);
		const durationSeconds = await readDuration(url);
		add({
			title: stripExtension(file.name),
			description: '',
			url,
			createdAt: new Date(),
			durationSeconds
		});
	}
}

function toggleRecordingTag(recordingId: string, tagId: string) {
	const recording = all.find((r) => r.id === recordingId);
	if (!recording) return;
	recording.tagIds = recording.tagIds.includes(tagId)
		? recording.tagIds.filter((id) => id !== tagId)
		: [...recording.tagIds, tagId];
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

function trash(id: string) {
	const recording = all.find((r) => r.id === id);
	if (recording) recording.trashedAt = new Date();
}

function restore(id: string) {
	const recording = all.find((r) => r.id === id);
	if (recording) recording.trashedAt = null;
}

function deleteForever(id: string) {
	const recording = all.find((r) => r.id === id);
	if (recording) URL.revokeObjectURL(recording.url);
	all = all.filter((r) => r.id !== id);
}

function daysLeft(recording: LocalRecording) {
	if (!recording.trashedAt) return null;
	const elapsedDays = (Date.now() - recording.trashedAt.getTime()) / (1000 * 60 * 60 * 24);
	return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
}

function purgeExpired() {
	const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
	const expired = all.filter((r) => r.trashedAt && r.trashedAt.getTime() < cutoff);
	for (const recording of expired) URL.revokeObjectURL(recording.url);
	if (expired.length > 0) all = all.filter((r) => !expired.includes(r));
}

export const recordingsStore = {
	get active() {
		return active;
	},
	get trashed() {
		return trashed;
	},
	get search() {
		return search;
	},
	get selectedTagIds() {
		return selectedTagIds;
	},
	add,
	importFiles,
	toggleRecordingTag,
	toggleFilterTag,
	clearFilters,
	setSearch,
	trash,
	restore,
	deleteForever,
	daysLeft,
	purgeExpired
};
