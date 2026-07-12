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
