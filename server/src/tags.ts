import type { Tag } from "@recoral/shared";
import { db } from "./db";

interface TagRow {
	id: string;
	name: string;
	hue: number;
	created_at: string;
}

function toTag(row: TagRow): Tag {
	return { id: row.id, name: row.name, hue: row.hue, createdAt: row.created_at };
}

export function listTags(userId: string): Tag[] {
	const rows = db
		.query<TagRow, [string]>("SELECT id, name, hue, created_at FROM tags WHERE user_id = ? ORDER BY name")
		.all(userId);
	return rows.map(toTag);
}

export function createTag(userId: string, name: string, hue: number): Tag {
	const trimmed = name.trim();
	if (!trimmed) throw new Error("Tag name is required");

	const existing = db
		.query<{ id: string }, [string, string]>("SELECT id FROM tags WHERE user_id = ? AND name = ?")
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

	return { id, name: trimmed, hue: normalizedHue, createdAt };
}

export function updateTag(userId: string, tagId: string, updates: { name?: string; hue?: number }): Tag {
	const existing = db
		.query<TagRow, [string, string]>("SELECT id, name, hue, created_at FROM tags WHERE id = ? AND user_id = ?")
		.get(tagId, userId);
	if (!existing) throw new Error("Tag not found");

	let name = existing.name;
	if (updates.name !== undefined) {
		name = updates.name.trim();
		if (!name) throw new Error("Tag name is required");

		const clash = db
			.query<{ id: string }, [string, string, string]>(
				"SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ?"
			)
			.get(userId, name, tagId);
		if (clash) throw new Error("A tag with that name already exists");
	}

	const hue = updates.hue !== undefined ? Math.round(((updates.hue % 360) + 360) % 360) : existing.hue;

	db.run("UPDATE tags SET name = ?, hue = ? WHERE id = ?", [name, hue, tagId]);
	return { id: tagId, name, hue, createdAt: existing.created_at };
}

export function deleteTag(userId: string, tagId: string) {
	db.run("DELETE FROM tags WHERE id = ? AND user_id = ?", [tagId, userId]);
}
