import { extname } from "node:path";
import { ZipArchive } from "archiver";
import { getAudioFile, listRecordings } from "./recordings";
import { listTags } from "./tags";

export interface ExportManifestTag {
	id: string;
	name: string;
	hue: number;
}

export interface ExportManifestRecording {
	id: string;
	title: string;
	description: string;
	createdAt: string;
	durationSeconds: number;
	favorite: boolean;
	archivedAt: string | null;
	transcript: string | null;
	tagIds: string[];
	audioFile: string;
}

export interface ExportManifest {
	formatVersion: 1;
	exportedAt: string;
	tags: ExportManifestTag[];
	recordings: ExportManifestRecording[];
}

export interface ExportStats {
	recordingCount: number;
	tagCount: number;
	totalDurationSeconds: number;
}

export function getExportStats(userId: string): ExportStats {
	const tags = listTags(userId).filter((t) => t.trashedAt === null);
	const recordings = listRecordings(userId).filter((r) => r.trashedAt === null);
	return {
		recordingCount: recordings.length,
		tagCount: tags.length,
		totalDurationSeconds: recordings.reduce((sum, r) => sum + r.durationSeconds, 0)
	};
}

// Trashed tags/recordings are deliberately left out: this is a backup of your
// active library, not a way to resurrect things you already threw away.
export function buildExportArchive(userId: string) {
	const archive = new ZipArchive({ zlib: { level: 6 } });

	const tags = listTags(userId).filter((t) => t.trashedAt === null);
	const recordings = listRecordings(userId).filter((r) => r.trashedAt === null);

	const manifest: ExportManifest = {
		formatVersion: 1,
		exportedAt: new Date().toISOString(),
		tags: tags.map((t) => ({ id: t.id, name: t.name, hue: t.hue })),
		recordings: []
	};

	for (const recording of recordings) {
		const audio = getAudioFile(userId, recording.id);
		if (!audio) continue;

		const ext = extname(audio.path) || ".bin";
		const audioFile = `recordings/${recording.id}${ext}`;

		manifest.recordings.push({
			id: recording.id,
			title: recording.title,
			description: recording.description,
			createdAt: recording.createdAt,
			durationSeconds: recording.durationSeconds,
			favorite: recording.favorite,
			archivedAt: recording.archivedAt,
			transcript: recording.transcript,
			tagIds: recording.tagIds,
			audioFile
		});

		archive.file(audio.path, { name: audioFile });
	}

	archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
	archive.finalize();

	return archive;
}
