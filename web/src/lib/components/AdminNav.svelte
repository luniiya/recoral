<script lang="ts">
	import { page } from '$app/state';

	type IconPart = { type: 'path'; d: string } | { type: 'circle'; cx: number; cy: number; r: number };

	const items: { href: string; label: string; icon: IconPart[] }[] = [
		{
			href: '/admin',
			label: 'General',
			icon: [
				{ type: 'circle', cx: 12, cy: 12, r: 3 },
				{
					type: 'path',
					d: 'M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9'
				}
			]
		},
		{
			href: '/admin/login',
			label: 'Login page',
			icon: [
				{ type: 'path', d: 'M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
				{ type: 'path', d: 'M9 21h6M12 18v3' }
			]
		},
		{
			href: '/admin/transcription',
			label: 'Transcription',
			icon: [
				{ type: 'path', d: 'M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z' },
				{ type: 'path', d: 'M8 9h4M8 12h8M8 15h8' }
			]
		},
		{
			href: '/admin/users',
			label: 'Users',
			icon: [
				{ type: 'circle', cx: 9, cy: 8, r: 3 },
				{ type: 'path', d: 'M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5' },
				{ type: 'circle', cx: 17, cy: 9, r: 2.3 },
				{ type: 'path', d: 'M14.9 13.7c.55-.15 1.15-.2 1.6-.2 2.5 0 4.5 2 4.5 4.5' }
			]
		}
	];

	// The General item stays active at the bare /admin root only, distinct
	// entries for Transcription/Users, exact match works for all three since
	// there's no further nesting under any of them.
	function isActive(href: string) {
		return page.url.pathname === href;
	}
</script>

{#snippet icon(parts: IconPart[])}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5 shrink-0">
		{#each parts as part, i (i)}
			{#if part.type === 'circle'}
				<circle cx={part.cx} cy={part.cy} r={part.r} />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" d={part.d} />
			{/if}
		{/each}
	</svg>
{/snippet}

<nav class="hidden h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 md:flex">
	{#each items as item (item.href)}
		<a
			href={item.href}
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
				{isActive(item.href)
				? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}"
		>
			{@render icon(item.icon)}
			{item.label}
		</a>
	{/each}
</nav>

<nav class="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3 md:hidden dark:border-white/10">
	{#each items as item (item.href)}
		<a
			href={item.href}
			class="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition
				{isActive(item.href)
				? 'bg-accent-500 text-white'
				: 'text-gray-600 ring-1 ring-gray-200 dark:text-gray-300 dark:ring-white/10'}"
		>
			{@render icon(item.icon)}
			{item.label}
		</a>
	{/each}
</nav>
