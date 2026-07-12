export type LocalRecording = {
	id: string;
	title: string;
	description: string;
	url: string;
	createdAt: Date;
	durationSeconds: number;
	tagIds: string[];
};

let list = $state<LocalRecording[]>([]);
let search = $state('');
let selectedTagIds = $state<string[]>([]);

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

function add(entry: Omit<LocalRecording, 'id' | 'tagIds'>) {
	list = [{ id: crypto.randomUUID(), tagIds: [], ...entry }, ...list];
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
	const recording = list.find((r) => r.id === recordingId);
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

export const recordingsStore = {
	get list() {
		return list;
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
	setSearch
};
