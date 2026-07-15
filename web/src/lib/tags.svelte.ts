import type { Tag } from '@recoral/shared';
import { api } from './api.svelte';
import { readLocalCache, writeLocalCache } from './localCache';

const TAG_TRASH_RETENTION_DAYS = 30;
const CACHED_TAGS_KEY = 'recoral_cached_tags';

let all = $state<Tag[]>(readLocalCache<Tag[]>(CACHED_TAGS_KEY, []));
let loaded = $state(false);

let list = $derived(all.filter((t) => t.trashedAt === null));
let trashed = $derived(all.filter((t) => t.trashedAt !== null));

async function load() {
	try {
		const res = await api.fetch('/api/tags', { credentials: 'include' });
		if (res.ok) {
			all = await res.json();
			writeLocalCache(CACHED_TAGS_KEY, all);
		}
	} catch {
		// Offline: keep showing whatever was cached from the last successful load.
	} finally {
		loaded = true;
	}
}

async function create(name: string, hue: number): Promise<Tag> {
	const res = await api.fetch('/api/tags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ name, hue })
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
	all = [...all, body];
	return body;
}

async function update(id: string, updates: { name?: string; hue?: number }): Promise<Tag> {
	const res = await api.fetch(`/api/tags/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(updates)
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
	all = all.map((t) => (t.id === id ? body : t));
	return body;
}

// Trashing/restoring/deleting a tag cascades to its subtags server-side, so a
// single-row local patch can't keep the client in sync; just reload the list.
async function trash(id: string) {
	await api.fetch(`/api/tags/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ trashed: true })
	});
	await load();
}

async function restore(id: string) {
	const res = await api.fetch(`/api/tags/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ trashed: false })
	});
	const body = await res.json();
	if (!res.ok) {
		await load();
		throw new Error(body.error ?? 'Something went wrong');
	}
	await load();
}

async function deleteForever(id: string) {
	await api.fetch(`/api/tags/${id}`, { method: 'DELETE', credentials: 'include' });
	await load();
}

function daysLeft(tag: Tag) {
	if (!tag.trashedAt) return null;
	const elapsedDays = (Date.now() - new Date(tag.trashedAt).getTime()) / (1000 * 60 * 60 * 24);
	return Math.max(0, Math.ceil(TAG_TRASH_RETENTION_DAYS - elapsedDays));
}

export const tagsStore = {
	get list() {
		return list;
	},
	get trashed() {
		return trashed;
	},
	get loaded() {
		return loaded;
	},
	load,
	create,
	update,
	trash,
	restore,
	deleteForever,
	daysLeft
};
