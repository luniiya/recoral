<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import { navIcons } from '$lib/navIcons';
	import { tabTapStore } from '$lib/tabTap.svelte';
	import Avatar from './Avatar.svelte';

	const items = [
		{ href: '/', label: 'Recorder', ...navIcons.recordings },
		{ href: '/favourites', label: 'Favourites', ...navIcons.favourites },
		{ href: '/library', label: 'Library', ...navIcons.library }
	];

	// Every Library sub-page (Tags/Archive/Bin) should still light up the
	// Library tab, not leave the bar looking like nothing is selected.
	const librarySubPaths = ['/library', '/tags', '/archive', '/bin'];
	function isActive(href: string) {
		if (href === '/library') return librarySubPaths.includes(page.url.pathname);
		return page.url.pathname === href;
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-gray-200 bg-white pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom))] md:hidden dark:border-white/10 dark:bg-black"
>
	{#each items as item (item.href)}
		<a
			href={item.href}
			onclick={(e) => {
				if (page.url.pathname !== item.href) return;
				e.preventDefault();
				tabTapStore.tap(item.href);
			}}
			class="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium
				{isActive(item.href) ? 'text-accent-600 dark:text-accent-400' : 'text-gray-500 dark:text-gray-400'}"
		>
			<svg
				viewBox="0 0 24 24"
				fill={item.stroke ? 'none' : 'currentColor'}
				stroke={item.stroke ? 'currentColor' : 'none'}
				stroke-width={item.stroke ? '1.8' : '0'}
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-5.5"
			>
				<path d={item.path} />
			</svg>
			{item.label}
		</a>
	{/each}

	<a href="/account" class="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium">
		{#if auth.user}
			<span
				class="rounded-full {page.url.pathname === '/account'
					? 'ring-2 ring-accent-500'
					: ''}"
			>
				<Avatar name={auth.user.username} avatar={auth.user.avatar} size="size-5.5" />
			</span>
		{/if}
		<span
			class={page.url.pathname === '/account'
				? 'text-accent-600 dark:text-accent-400'
				: 'text-gray-500 dark:text-gray-400'}
		>
			Account
		</span>
	</a>
</nav>
