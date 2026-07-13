import type { Recording } from "@recoral/shared";
import { mkdirSync, unlinkSync } from "node:fs";
import { db } from "./db";
import { getSettings } from "./settings";

const dataDir = process.env.DATA_DIR ?? "./data";
const RECORDINGS_DIR = `${dataDir}/recordings`;
const TRASH_RETENTION_DAYS = 30;

interface RecordingRow {
	id: string;
	user_id: string;
	title: string;
	description: string;
	file_path: string;
	content_hash: string;
	duration_seconds: number;
	file_size_bytes: number;
	mime_type: string;
	favorite: number;
	archived_at: string | null;
	trashed_at: string | null;
	created_at: string;
	transcript: string | null;
}

export class DuplicateError extends Error {
	existing: Recording;
	constructor(existing: Recording) {
		super(`"${existing.title}" is already in your library`);
		this.existing = existing;
	}
}

export class QuotaError extends Error {}

// A user's own limit (if set) caps them individually. Otherwise everyone draws
// from the one shared server-wide pool.
export function checkStorageQuota(userId: string, userStorageLimitMb: number | null, incomingBytes: number) {
	if (userStorageLimitMb !== null) {
		if (userStorageBytes(userId) + incomingBytes > userStorageLimitMb * 1024 * 1024) {
			throw new QuotaError("You've reached your storage limit");
		}
		return;
	}

	const serverLimitMb = getSettings().serverStorageLimitMb;
	if (serverLimitMb !== null && globalStorageBytes() + incomingBytes > serverLimitMb * 1024 * 1024) {
		throw new QuotaError("The server has reached its storage limit");
	}
}

function tagIdsFor(recordingId: string): string[] {
	const rows = db
		.query<{ tag_id: string }, [string]>("SELECT tag_id FROM recording_tags WHERE recording_id = ?")
		.all(recordingId);
	return rows.map((r) => r.tag_id);
}

function toRecording(row: RecordingRow): Recording {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		createdAt: row.created_at,
		durationSeconds: row.duration_seconds,
		transcript: row.transcript,
		favorite: row.favorite === 1,
		archivedAt: row.archived_at,
		trashedAt: row.trashed_at,
		tagIds: tagIdsFor(row.id)
	};
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function extensionFor(mimeType: string, filename: string): string {
	const fromName = filename.split(".").pop();
	if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) return fromName;
	return mimeType.split("/")[1] ?? "bin";
}

function getRow(userId: string, id: string): RecordingRow | null {
	return db.query<RecordingRow, [string, string]>("SELECT * FROM recordings WHERE id = ? AND user_id = ?").get(id, userId);
}

export function listRecordings(userId: string): Recording[] {
	const rows = db
		.query<RecordingRow, [string]>("SELECT * FROM recordings WHERE user_id = ? ORDER BY created_at DESC")
		.all(userId);
	return rows.map(toRecording);
}

export function findByHash(userId: string, hash: string): Recording | null {
	const row = db
		.query<RecordingRow, [string, string]>(
			"SELECT * FROM recordings WHERE user_id = ? AND content_hash = ? AND trashed_at IS NULL"
		)
		.get(userId, hash);
	return row ? toRecording(row) : null;
}

export async function createRecording(params: {
	userId: string;
	title: string;
	file: File;
	durationSeconds: number;
	// Overrides for imported recordings (Google Takeout or recoral's own
	// export format), which arrive with their own real creation date and
	// possibly a description/transcript already, instead of "now"/''/null
	// like a freshly-recorded upload.
	createdAt?: string;
	description?: string;
	transcript?: string | null;
}): Promise<Recording> {
	const buffer = await params.file.arrayBuffer();
	const contentHash = await hashBuffer(buffer);

	const existing = findByHash(params.userId, contentHash);
	if (existing) throw new DuplicateError(existing);

	const id = crypto.randomUUID();
	const ext = extensionFor(params.file.type, params.file.name);
	const userDir = `${RECORDINGS_DIR}/${params.userId}`;
	mkdirSync(userDir, { recursive: true });
	const filePath = `${userDir}/${id}.${ext}`;
	await Bun.write(filePath, buffer);

	const createdAt = params.createdAt ?? new Date().toISOString();
	db.run(
		`INSERT INTO recordings
			(id, user_id, title, description, file_path, content_hash, duration_seconds, file_size_bytes, mime_type, created_at, transcript)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			params.userId,
			params.title,
			params.description ?? "",
			filePath,
			contentHash,
			params.durationSeconds,
			buffer.byteLength,
			params.file.type || "audio/mpeg",
			createdAt,
			params.transcript ?? null
		]
	);

	return toRecording(getRow(params.userId, id)!);
}

export function updateRecording(
	userId: string,
	id: string,
	updates: { title?: string; description?: string; favorite?: boolean; archived?: boolean; trashed?: boolean }
): Recording {
	const row = getRow(userId, id);
	if (!row) throw new Error("Recording not found");

	if (updates.title !== undefined) db.run("UPDATE recordings SET title = ? WHERE id = ?", [updates.title, id]);
	if (updates.description !== undefined) {
		db.run("UPDATE recordings SET description = ? WHERE id = ?", [updates.description, id]);
	}
	if (updates.favorite !== undefined) {
		db.run("UPDATE recordings SET favorite = ? WHERE id = ?", [updates.favorite ? 1 : 0, id]);
	}
	if (updates.archived !== undefined) {
		db.run("UPDATE recordings SET archived_at = ? WHERE id = ?", [
			updates.archived ? new Date().toISOString() : null,
			id
		]);
	}
	if (updates.trashed !== undefined) {
		db.run("UPDATE recordings SET trashed_at = ? WHERE id = ?", [
			updates.trashed ? new Date().toISOString() : null,
			id
		]);
	}

	return toRecording(getRow(userId, id)!);
}

export function deleteRecording(userId: string, id: string) {
	const row = getRow(userId, id);
	if (!row) return;
	try {
		unlinkSync(row.file_path);
	} catch {}
	db.run("DELETE FROM recording_tags WHERE recording_id = ?", [id]);
	db.run("DELETE FROM recordings WHERE id = ?", [id]);
}

export function purgeExpiredTrash() {
	const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const rows = db
		.query<RecordingRow, [string]>("SELECT * FROM recordings WHERE trashed_at IS NOT NULL AND trashed_at < ?")
		.all(cutoff);
	for (const row of rows) {
		try {
			unlinkSync(row.file_path);
		} catch {}
		db.run("DELETE FROM recording_tags WHERE recording_id = ?", [row.id]);
		db.run("DELETE FROM recordings WHERE id = ?", [row.id]);
	}
}

export function attachTag(userId: string, recordingId: string, tagId: string) {
	if (!getRow(userId, recordingId)) throw new Error("Recording not found");
	db.run("INSERT OR IGNORE INTO recording_tags (recording_id, tag_id) VALUES (?, ?)", [recordingId, tagId]);
}

export function detachTag(userId: string, recordingId: string, tagId: string) {
	if (!getRow(userId, recordingId)) throw new Error("Recording not found");
	db.run("DELETE FROM recording_tags WHERE recording_id = ? AND tag_id = ?", [recordingId, tagId]);
}

export function userStorageBytes(userId: string): number {
	const row = db
		.query<{ total: number | null }, [string]>("SELECT SUM(file_size_bytes) as total FROM recordings WHERE user_id = ?")
		.get(userId);
	return row?.total ?? 0;
}

export function globalStorageBytes(): number {
	const row = db.query<{ total: number | null }, []>("SELECT SUM(file_size_bytes) as total FROM recordings").get();
	return row?.total ?? 0;
}

export function getAudioFile(userId: string, id: string): { path: string; mimeType: string } | null {
	const row = getRow(userId, id);
	return row ? { path: row.file_path, mimeType: row.mime_type } : null;
}
