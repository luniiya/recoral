<script lang="ts">
	import { page } from '$app/state';
	import { navIcons } from '$lib/navIcons';
	import ServerStatus from './ServerStatus.svelte';

	const items = [
		{ href: '/', label: 'Recordings', ...navIcons.recordings },
		{ href: '/favourites', label: 'Favourites', ...navIcons.favourites },
		{ href: '/tags', label: 'Tags', ...navIcons.tags },
		{ href: '/archive', label: 'Archive', ...navIcons.archive },
		{ href: '/bin', label: 'Bin', ...navIcons.bin }
	];
</script>

<nav class="hidden h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 md:flex">
	{#each items as item (item.href)}
		{@const active = page.url.pathname === item.href}
		<a
			href={item.href}
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
				{active
				? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}"
		>
			<svg
				viewBox="0 0 24 24"
				fill={item.stroke ? 'none' : 'currentColor'}
				stroke={item.stroke ? 'currentColor' : 'none'}
				stroke-width={item.stroke ? '1.8' : '0'}
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-5"
			>
				<path d={item.path} />
			</svg>
			{item.label}
		</a>
	{/each}

	<div class="flex-1"></div>

	<ServerStatus />
</nav>
