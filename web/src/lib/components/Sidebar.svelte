<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import { onMount } from 'svelte';

	const items = [
		{
			href: '/',
			label: 'Recordings',
			icon: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z',
			stroke: false
		},
		{
			href: '/tags',
			label: 'Tags',
			icon: 'M20.59 13.41 12 4.83A2 2 0 0 0 10.59 4.24L4 4a1 1 0 0 0-1 1l.24 6.59a2 2 0 0 0 .59 1.41l8.58 8.59a2 2 0 0 0 2.83 0l5.35-5.35a2 2 0 0 0 0-2.83ZM7.5 9A1.5 1.5 0 1 1 7.5 6a1.5 1.5 0 0 1 0 3Z',
			stroke: false
		},
		{
			href: '/favourites',
			label: 'Favourites',
			icon: 'M12 6.3C10.4 4.6 8 4 6.2 5.5 4.4 7 4.1 9.7 5.6 11.5L12 19l6.4-7.5c1.5-1.8 1.2-4.5-.6-6C16 4 13.6 4.6 12 6.3Z',
			stroke: true
		},
		{
			href: '/archive',
			label: 'Archive',
			icon: 'M4 4h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 6h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Zm4.5 3a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2h-5Z',
			stroke: false
		},
		{
			href: '/bin',
			label: 'Bin',
			icon: 'M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7',
			stroke: true
		}
	];

	let version = $state('');
	let serverOnline = $state<boolean | null>(null);
	let usedBytes = $state(0);
	let limitMb = $state<number | null>(null);

	let usedGb = $derived(usedBytes / 1024 ** 3);
	let limitGb = $derived(limitMb !== null ? limitMb / 1024 : null);
	let usedPercent = $derived(limitGb !== null && limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0);

	onMount(async () => {
		try {
			const res = await fetch('/api/health');
			serverOnline = res.ok;
			if (res.ok) version = (await res.json()).version;
		} catch {
			serverOnline = false;
		}

		const storageRes = await fetch('/api/storage', { credentials: 'include' });
		if (storageRes.ok) {
			const usage = await storageRes.json();
			usedBytes = usage.usedBytes;
			limitMb = usage.limitMb;
		}
	});
</script>

<nav class="flex h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6">
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
				<path d={item.icon} />
			</svg>
			{item.label}
		</a>
	{/each}

	<div class="flex-1"></div>

	{#if auth.user}
		<div class="mb-3 rounded-lg bg-gray-100 p-3 dark:bg-white/5">
			<p class="mb-1.5 text-xs text-gray-600 dark:text-gray-300">
				{#if limitGb !== null}
					{usedGb.toFixed(1)} GB of {limitGb.toFixed(1)} GB used
				{:else}
					{usedGb.toFixed(1)} GB used, unlimited
				{/if}
			</p>
			<div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
				<div class="h-full rounded-full bg-accent-500" style:width="{usedPercent}%"></div>
			</div>
		</div>
	{/if}

	<div class="flex items-center justify-between px-1 text-xs text-gray-600 dark:text-gray-300">
		<span class="flex items-center gap-1.5">
			<span class="size-1.5 rounded-full {serverOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
			{serverOnline ? 'Server online' : 'Server unreachable'}
		</span>
		{#if version}<span>v{version}</span>{/if}
	</div>
</nav>
