import type { Tag } from "@recoral/shared";
import { db } from "./db";
import { broadcast } from "./realtime";

const TAG_TRASH_RETENTION_DAYS = 30;

interface TagRow {
	id: string;
	name: string;
	hue: number;
	created_at: string;
	trashed_at: string | null;
}

function toTag(row: TagRow): Tag {
	return { id: row.id, name: row.name, hue: row.hue, createdAt: row.created_at, trashedAt: row.trashed_at };
}

// A tag's subtags are just other tags whose name is prefixed with
// `${name}/`, so this covers a tag plus its whole subtree, at any depth.
function collectGroup(userId: string, name: string): TagRow[] {
	return db
		.query<TagRow, [string, string, string]>(
			"SELECT id, name, hue, created_at, trashed_at FROM tags WHERE user_id = ? AND (name = ? OR name LIKE ?)"
		)
		.all(userId, name, `${name}/%`);
}

export function listTags(userId: string): Tag[] {
	const rows = db
		.query<TagRow, [string]>("SELECT id, name, hue, created_at, trashed_at FROM tags WHERE user_id = ? ORDER BY name")
		.all(userId);
	return rows.map(toTag);
}

export function createTag(userId: string, name: string, hue: number): Tag {
	const trimmed = name.trim();
	if (!trimmed) throw new Error("Tag name is required");

	const existing = db
		.query<{ id: string }, [string, string]>(
			"SELECT id FROM tags WHERE user_id = ? AND name = ? AND trashed_at IS NULL"
		)
		.get(userId, trimmed);
	if (existing) throw new Error("A tag with that name already exists");

	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const normalizedHue = Math.round(((hue % 360) + 360) % 360);

	db.run("INSERT INTO tags (id, user_id, name, hue, created_at) VALUES (?, ?, ?, ?, ?)", [
		id,
		userId,
		trimmed,
		normalizedHue,
		createdAt
	]);

	broadcast(userId, "tags");
	return { id, name: trimmed, hue: normalizedHue, createdAt, trashedAt: null };
}

export function updateTag(
	userId: string,
	tagId: string,
	updates: { name?: string; hue?: number; trashed?: boolean }
): Tag {
	const existing = db
		.query<TagRow, [string, string]>(
			"SELECT id, name, hue, created_at, trashed_at FROM tags WHERE id = ? AND user_id = ?"
		)
		.get(tagId, userId);
	if (!existing) throw new Error("Tag not found");

	let name = existing.name;
	if (updates.name !== undefined) {
		name = updates.name.trim();
		if (!name) throw new Error("Tag name is required");

		const clash = db
			.query<{ id: string }, [string, string, string]>(
				"SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ? AND trashed_at IS NULL"
			)
			.get(userId, name, tagId);
		if (clash) throw new Error("A tag with that name already exists");
	}

	const hue = updates.hue !== undefined ? Math.round(((updates.hue % 360) + 360) % 360) : existing.hue;

	let trashedAt = existing.trashed_at;

	if (updates.trashed === true && !existing.trashed_at) {
		trashedAt = new Date().toISOString();
		const descendants = collectGroup(userId, existing.name).filter((r) => r.id !== tagId);
		for (const row of descendants) db.run("UPDATE tags SET trashed_at = ? WHERE id = ?", [trashedAt, row.id]);
	} else if (updates.trashed === false && existing.trashed_at) {
		const group = collectGroup(userId, existing.name);
		// Restoring a whole group at once: check every member's name against
		// active tags first, so a mid-group clash doesn't leave it half-restored.
		for (const row of group) {
			const restoredName = row.id === tagId ? name : row.name;
			const clash = db
				.query<{ id: string }, [string, string, string]>(
					"SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ? AND trashed_at IS NULL"
				)
				.get(userId, restoredName, row.id);
			if (clash) throw new Error(`"${restoredName}" already exists, rename it before restoring`);
		}
		trashedAt = null;
		for (const row of group) {
			if (row.id !== tagId) db.run("UPDATE tags SET trashed_at = NULL WHERE id = ?", [row.id]);
		}
	}

	db.run("UPDATE tags SET name = ?, hue = ?, trashed_at = ? WHERE id = ?", [name, hue, trashedAt, tagId]);
	broadcast(userId, "tags");
	return { id: tagId, name, hue, createdAt: existing.created_at, trashedAt };
}

export function deleteTagForever(userId: string, tagId: string) {
	const row = db
		.query<TagRow, [string, string]>(
			"SELECT id, name, hue, created_at, trashed_at FROM tags WHERE id = ? AND user_id = ?"
		)
		.get(tagId, userId);
	if (!row) return;

	for (const member of collectGroup(userId, row.name)) {
		db.run("DELETE FROM recording_tags WHERE tag_id = ?", [member.id]);
		db.run("DELETE FROM tags WHERE id = ?", [member.id]);
	}
	broadcast(userId, "tags");
}

export function purgeExpiredTagTrash() {
	const cutoff = new Date(Date.now() - TAG_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const rows = db
		.query<{ id: string }, [string]>("SELECT id FROM tags WHERE trashed_at IS NOT NULL AND trashed_at < ?")
		.all(cutoff);
	for (const row of rows) {
		db.run("DELETE FROM recording_tags WHERE tag_id = ?", [row.id]);
		db.run("DELETE FROM tags WHERE id = ?", [row.id]);
	}
}
