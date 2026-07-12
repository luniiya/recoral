import type { Tag } from '@recoral/shared';

let list = $state<Tag[]>([]);
let loaded = $state(false);

async function load() {
	const res = await fetch('/api/tags', { credentials: 'include' });
	if (res.ok) list = await res.json();
	loaded = true;
}

async function create(name: string, hue: number): Promise<Tag> {
	const res = await fetch('/api/tags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ name, hue })
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
	list = [...list, body].sort((a, b) => a.name.localeCompare(b.name));
	return body;
}

async function update(id: string, updates: { name?: string; hue?: number }): Promise<Tag> {
	const res = await fetch(`/api/tags/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(updates)
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? 'Something went wrong');
	list = list.map((t) => (t.id === id ? body : t)).sort((a, b) => a.name.localeCompare(b.name));
	return body;
}

async function remove(id: string) {
	list = list.filter((t) => t.id !== id);
	await fetch(`/api/tags/${id}`, { method: 'DELETE', credentials: 'include' });
}

export const tagsStore = {
	get list() {
		return list;
	},
	get loaded() {
		return loaded;
	},
	load,
	create,
	update,
	remove
};
