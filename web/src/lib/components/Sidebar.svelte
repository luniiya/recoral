<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{
			href: '/',
			label: 'Recordings',
			icon: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z'
		},
		{
			href: '/tags',
			label: 'Tags',
			icon: 'M20.59 13.41 12 4.83A2 2 0 0 0 10.59 4.24L4 4a1 1 0 0 0-1 1l.24 6.59a2 2 0 0 0 .59 1.41l8.58 8.59a2 2 0 0 0 2.83 0l5.35-5.35a2 2 0 0 0 0-2.83ZM7.5 9A1.5 1.5 0 1 1 7.5 6a1.5 1.5 0 0 1 0 3Z'
		}
	];
</script>

<nav class="flex h-full w-56 shrink-0 flex-col gap-1 px-3 py-6">
	{#each items as item (item.href)}
		{@const active = page.url.pathname === item.href}
		<a
			href={item.href}
			class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
				{active
				? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
				<path d={item.icon} />
			</svg>
			{item.label}
		</a>
	{/each}
</nav>
