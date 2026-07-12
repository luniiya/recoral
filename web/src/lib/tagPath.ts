import type { Tag } from '@recoral/shared';

export interface TagNode {
	label: string;
	path: string;
	tag: Tag | null;
	children: TagNode[];
}

export function tagSegments(name: string): string[] {
	return name
		.split('/')
		.map((s) => s.trim())
		.filter(Boolean);
}

export function tagBreadcrumb(name: string) {
	return tagSegments(name).join(' › ');
}

export function tagLeafLabel(name: string) {
	const segments = tagSegments(name);
	return segments[segments.length - 1] ?? name;
}

export function parentTag(tag: Tag, allTags: Tag[]): Tag | null {
	const segments = tagSegments(tag.name);
	if (segments.length < 2) return null;
	const parentName = segments.slice(0, -1).join('/');
	return allTags.find((t) => t.name === parentName) ?? null;
}

export interface TrashedTagGroup {
	root: Tag;
	descendants: Tag[];
}

// Trashing a tag cascades to its subtags server-side (see server/src/tags.ts),
// so they always share a trashedAt and belong in the same Bin card. Groups by
// the nearest trashed ancestor rather than assuming a flat parent/child pair,
// since a subtag can be trashed on its own with its parent still active.
export function groupTrashedTags(trashedTags: Tag[]): TrashedTagGroup[] {
	const byName = new Map(trashedTags.map((t) => [t.name, t]));

	function nearestTrashedAncestor(tag: Tag): Tag | null {
		const segments = tagSegments(tag.name);
		for (let i = segments.length - 1; i >= 1; i--) {
			const ancestor = byName.get(segments.slice(0, i).join('/'));
			if (ancestor) return ancestor;
		}
		return null;
	}

	function rootOf(tag: Tag): Tag {
		let current = tag;
		for (let ancestor = nearestTrashedAncestor(current); ancestor; ancestor = nearestTrashedAncestor(current)) {
			current = ancestor;
		}
		return current;
	}

	const groups = new Map<string, TrashedTagGroup>();
	for (const tag of trashedTags) {
		const root = rootOf(tag);
		if (!groups.has(root.id)) groups.set(root.id, { root, descendants: [] });
		if (root.id !== tag.id) groups.get(root.id)!.descendants.push(tag);
	}
	return [...groups.values()];
}

export function collectTagIds(node: TagNode): string[] {
	const ids = node.tag ? [node.tag.id] : [];
	for (const child of node.children) ids.push(...collectTagIds(child));
	return ids;
}

export function buildTagTree(tags: Tag[]): TagNode[] {
	const roots: TagNode[] = [];
	const nodeByPath = new Map<string, TagNode>();

	const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

	for (const tag of sorted) {
		const segments = tagSegments(tag.name);
		let path = '';
		let siblings = roots;

		for (let i = 0; i < segments.length; i++) {
			path = path ? `${path}/${segments[i]}` : segments[i];
			let node = nodeByPath.get(path);
			if (!node) {
				node = { label: segments[i], path, tag: null, children: [] };
				nodeByPath.set(path, node);
				siblings.push(node);
			}
			if (i === segments.length - 1) node.tag = tag;
			siblings = node.children;
		}
	}

	return roots;
}
