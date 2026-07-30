<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';

	let items = $derived([
		{ href: '/settings', label: 'Account' },
		{ href: '/settings/appearance', label: 'Appearance' },
		{ href: '/settings/import', label: 'Import' },
		{ href: '/settings/export', label: 'Export' },
		...(auth.user?.isAdmin ? [{ href: '/admin', label: 'Admin' }] : [])
	]);

	// The Admin item stays highlighted across all three admin sub-routes
	// (General/Transcription/Users), not just the bare /admin root.
	function isActive(href: string) {
		if (href === '/admin') return page.url.pathname.startsWith('/admin');
		return page.url.pathname === href;
	}
</script>

<!-- Desktop: a real sidebar, same visual treatment as the main app's
     Sidebar.svelte (no icons here, these aren't primary-nav concepts with
     existing icons, just labeled rows). Mobile: a horizontal scrollable tab
     strip, same item list, since a persistent sidebar doesn't fit there. -->
<nav class="hidden h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 md:flex">
	{#each items as item (item.href)}
		<a
			href={item.href}
			class="rounded-lg px-3 py-2 text-sm font-medium transition
				{isActive(item.href)
				? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400'
				: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}"
		>
			{item.label}
		</a>
	{/each}
</nav>

<nav class="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-3 md:hidden dark:border-white/10">
	{#each items as item (item.href)}
		<a
			href={item.href}
			class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition
				{isActive(item.href)
				? 'bg-accent-500 text-white'
				: 'text-gray-600 ring-1 ring-gray-200 dark:text-gray-300 dark:ring-white/10'}"
		>
			{item.label}
		</a>
	{/each}
</nav>
