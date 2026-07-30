<script lang="ts">
	import { page } from '$app/state';

	type IconPart = { type: 'path'; d: string } | { type: 'circle'; cx: number; cy: number; r: number };

	const items: { href: string; label: string; icon: IconPart[] }[] = [
		{
			href: '/settings',
			label: 'Account',
			icon: [
				{ type: 'circle', cx: 12, cy: 8, r: 3.2 },
				{ type: 'path', d: 'M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6' }
			]
		},
		{
			href: '/settings/sessions',
			label: 'Sessions',
			icon: [
				{ type: 'path', d: 'M5 4.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z' },
				{ type: 'path', d: 'M3 16.5h15' }
			]
		},
		{
			href: '/settings/appearance',
			label: 'Appearance',
			icon: [
				{ type: 'circle', cx: 9, cy: 9, r: 3.2 },
				{ type: 'circle', cx: 15, cy: 9, r: 3.2 },
				{ type: 'circle', cx: 12, cy: 15, r: 3.2 }
			]
		},
		{
			href: '/settings/import',
			label: 'Import',
			icon: [
				{ type: 'path', d: 'M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5' },
				{ type: 'path', d: 'M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3' }
			]
		},
		{
			href: '/settings/export',
			label: 'Export',
			icon: [
				{ type: 'path', d: 'M12 14V4m0 0 3.5 3.5M12 4 8.5 7.5' },
				{ type: 'path', d: 'M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3' }
			]
		}
	];

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
