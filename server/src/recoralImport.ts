import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yauzl from "yauzl";
import type { ExportManifest } from "./dataExport";
import { attachTag, checkStorageQuota, createRecording, DuplicateError, QuotaError, updateRecording } from "./recordings";
import { createTag, listTags } from "./tags";
import { enqueueTranscription } from "./transcription";

const MIME_TYPES: Record<string, string> = {
	".m4a": "audio/mp4",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
	".flac": "audio/flac",
	".webm": "audio/webm"
};

export type ImportJobStatus = "processing" | "done" | "failed";

export interface ImportJob {
	id: string;
	userId: string;
	status: ImportJobStatus;
	total: number;
	processed: number;
	imported: number;
	duplicates: number;
	errors: number;
	errorMessages: string[];
	quotaReached: boolean;
	totalDurationSeconds: number;
	transcribedCount: number;
	earliestDate: string | null;
	latestDate: string | null;
}

const jobs = new Map<string, ImportJob>();

// Reads the manifest fully (small JSON) and streams every referenced audio
// file straight to a temp file on disk, never buffering the whole archive
// into memory at once, same approach as the Takeout importer.
function extractZip(zipPath: string, workDir: string): Promise<{ manifest: ExportManifest; audioPaths: Map<string, string> }> {
	const audioPaths = new Map<string, string>();
	let manifest: ExportManifest | null = null;

	return new Promise((resolve, reject) => {
		yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
			if (err || !zipfile) {
				reject(err ?? new Error("Failed to open the export archive"));
				return;
			}

			zipfile.readEntry();

			zipfile.on("entry", (entry) => {
				const name = entry.fileName;
				if (name.endsWith("/")) {
					zipfile.readEntry();
					return;
				}

				if (name === "manifest.json") {
					zipfile.openReadStream(entry, (err, readStream) => {
						if (err || !readStream) {
							zipfile.readEntry();
							return;
						}
						const chunks: Buffer[] = [];
						readStream.on("data", (chunk) => chunks.push(chunk as Buffer));
						readStream.on("end", () => {
							try {
								manifest = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
							} catch {
								// left null, handled after the archive finishes reading
							}
							zipfile.readEntry();
						});
						readStream.on("error", () => zipfile.readEntry());
					});
					return;
				}

				if (name.startsWith("recordings/")) {
					const tempPath = join(workDir, `${crypto.randomUUID()}${name.slice(name.lastIndexOf("."))}`);
					zipfile.openReadStream(entry, (err, readStream) => {
						if (err || !readStream) {
							zipfile.readEntry();
							return;
						}
						const writeStream = createWriteStream(tempPath);
						readStream.pipe(writeStream);
						writeStream.on("finish", () => {
							audioPaths.set(name, tempPath);
							zipfile.readEntry();
						});
						writeStream.on("error", () => zipfile.readEntry());
					});
					return;
				}

				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				if (!manifest) {
					reject(new Error("This doesn't look like a recoral export (no manifest.json found)"));
					return;
				}
				resolve({ manifest, audioPaths });
			});
			zipfile.on("error", reject);
		});
	});
}

async function runImport(job: ImportJob, userId: string, userStorageLimitMb: number | null, zipPath: string) {
	const workDir = mkdtempSync(join(tmpdir(), "recoral-import-"));

	try {
		const { manifest, audioPaths } = await extractZip(zipPath, workDir);
		job.total = manifest.recordings.length;

		// Resolve every exported tag to a tag id in this account first: reuse
		// an existing active tag by name if one already exists (so re-importing
		// into the same account doesn't create duplicate tags), otherwise
		// recreate it with its original color.
		const existingByName = new Map(listTags(userId).map((t) => [t.name, t]));
		const tagIdMap = new Map<string, string>();
		for (const tag of manifest.tags) {
			const existing = existingByName.get(tag.name);
			if (existing) {
				tagIdMap.set(tag.id, existing.id);
			} else {
				const created = createTag(userId, tag.name, tag.hue);
				existingByName.set(created.name, created);
				tagIdMap.set(tag.id, created.id);
			}
		}

		for (const entry of manifest.recordings) {
			const audioPath = audioPaths.get(entry.audioFile);
			if (!audioPath) {
				job.errors++;
				job.errorMessages.push(`${entry.title || entry.id}: audio file missing from archive`);
				job.processed++;
				continue;
			}

			try {
				const bytes = await readFile(audioPath);
				checkStorageQuota(userId, userStorageLimitMb, bytes.byteLength);

				const ext = entry.audioFile.slice(entry.audioFile.lastIndexOf("."));
				const file = new File([bytes], `${entry.id}${ext}`, { type: MIME_TYPES[ext] ?? "audio/mpeg" });

				const recording = await createRecording({
					userId,
					title: entry.title,
					description: entry.description,
					file,
					durationSeconds: entry.durationSeconds,
					createdAt: entry.createdAt,
					transcript: entry.transcript
				});
				if (!entry.transcript) enqueueTranscription(recording.id);

				if (entry.favorite || entry.archivedAt) {
					updateRecording(userId, recording.id, {
						favorite: entry.favorite,
						archived: entry.archivedAt !== null
					});
				}

				for (const oldTagId of entry.tagIds) {
					const newTagId = tagIdMap.get(oldTagId);
					if (newTagId) attachTag(userId, recording.id, newTagId);
				}

				job.imported++;
				job.totalDurationSeconds += entry.durationSeconds;
				if (entry.transcript) job.transcribedCount++;
				if (!job.earliestDate || entry.createdAt < job.earliestDate) job.earliestDate = entry.createdAt;
				if (!job.latestDate || entry.createdAt > job.latestDate) job.latestDate = entry.createdAt;
			} catch (err) {
				if (err instanceof DuplicateError) {
					job.duplicates++;
				} else if (err instanceof QuotaError) {
					job.quotaReached = true;
					job.errorMessages.push(err.message);
					break;
				} else {
					job.errors++;
					job.errorMessages.push(`${entry.title || entry.id}: ${(err as Error).message}`);
				}
			} finally {
				job.processed++;
				unlink(audioPath).catch(() => {});
			}
		}

		job.status = "done";
	} catch (err) {
		job.status = "failed";
		job.errorMessages.push((err as Error).message);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
		unlink(zipPath).catch(() => {});
	}
}

export function startRecoralImport(userId: string, userStorageLimitMb: number | null, zipPath: string): string {
	const jobId = crypto.randomUUID();
	const job: ImportJob = {
		id: jobId,
		userId,
		status: "processing",
		total: 0,
		processed: 0,
		imported: 0,
		duplicates: 0,
		errors: 0,
		errorMessages: [],
		quotaReached: false,
		totalDurationSeconds: 0,
		transcribedCount: 0,
		earliestDate: null,
		latestDate: null
	};
	jobs.set(jobId, job);

	runImport(job, userId, userStorageLimitMb, zipPath).catch((err) => {
		job.status = "failed";
		job.errorMessages.push((err as Error).message);
	});

	return jobId;
}

export function getRecoralImportJob(userId: string, jobId: string): ImportJob | null {
	const job = jobs.get(jobId);
	return job && job.userId === userId ? job : null;
}
