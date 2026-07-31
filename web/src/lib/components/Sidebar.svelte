<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { navIcons } from '$lib/navIcons';
	import { vimMode } from '$lib/vimMode.svelte';
	import { vimZone } from '$lib/vimZone.svelte';
	import { onMount } from 'svelte';
	import ServerStatus from './ServerStatus.svelte';

	interface Props {
		// Auto-collapses to icon-only on desktop widths too narrow to fit
		// sidebar + list rail + detail panel side by side without cramping the
		// detail view, see (app)/(main)/+layout.svelte and detailPanel.svelte.ts.
		collapsed?: boolean;
	}

	let { collapsed = false }: Props = $props();

	const items = [
		{ href: '/', label: 'Recordings', ...navIcons.recordings },
		{ href: '/favourites', label: 'Favourites', ...navIcons.favourites },
		{ href: '/tags', label: 'Tags', ...navIcons.tags },
		{ href: '/archive', label: 'Archive', ...navIcons.archive },
		{ href: '/bin', label: 'Bin', ...navIcons.bin }
	];

	// The leftmost of vimNav.svelte.ts's navbar > list > detail panes: a
	// list page's own h (nothing left to close) hands focus here instead,
	// j/k move a highlight through these same nav items, l navigates to the
	// highlighted one and hands focus back to that page's own list.
	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (!vimZone.enabled || !vimZone.sidebarFocused) return;
			if (event.metaKey || event.ctrlKey || event.altKey || vimMode.isTyping) return;

			if (event.key === 'j') {
				event.preventDefault();
				vimZone.setSidebarCursorIndex(Math.min(items.length - 1, vimZone.sidebarCursorIndex + 1));
			} else if (event.key === 'k') {
				event.preventDefault();
				vimZone.setSidebarCursorIndex(Math.max(0, vimZone.sidebarCursorIndex - 1));
			} else if (event.key === 'l') {
				event.preventDefault();
				const target = items[vimZone.sidebarCursorIndex];
				vimZone.focusList();
				if (target) goto(target.href);
			}
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	// Start the highlight on whichever item matches the current page the
	// moment focus actually lands here, rather than wherever it was left
	// from a previous visit.
	$effect(() => {
		if (!vimZone.sidebarFocused) return;
		const index = items.findIndex((item) => item.href === page.url.pathname);
		if (index !== -1) vimZone.setSidebarCursorIndex(index);
	});
</script>

<nav
	class="hidden h-full shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 transition-[width] duration-300 md:flex
		{collapsed ? 'w-16' : 'w-56'}"
>
	{#each items as item, index (item.href)}
		{@const active = page.url.pathname === item.href}
		{@const vimCursor = vimZone.enabled && vimZone.sidebarFocused && vimZone.sidebarCursorIndex === index}
		<a
			href={item.href}
			title={collapsed ? item.label : undefined}
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
				{collapsed ? 'justify-center' : ''}
				{active
				? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}
				{vimCursor ? 'ring-2 ring-accent-300 dark:ring-accent-500/40' : ''}"
		>
			<svg
				viewBox="0 0 24 24"
				fill={item.stroke ? 'none' : 'currentColor'}
				stroke={item.stroke ? 'currentColor' : 'none'}
				stroke-width={item.stroke ? '1.8' : '0'}
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-5 shrink-0"
			>
				<path d={item.path} />
			</svg>
			{#if !collapsed}
				{item.label}
			{/if}
		</a>
	{/each}

	<div class="flex-1"></div>

	{#if !collapsed}
		<ServerStatus />
	{/if}
</nav>
