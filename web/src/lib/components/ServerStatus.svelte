<script lang="ts">
	import { APP_VERSION } from '@recoral/shared';
	import { api } from '$lib/api.svelte';
	import { auth } from '$lib/auth.svelte';
	import { readLocalCache, writeLocalCache } from '$lib/localCache';
	import { onMount } from 'svelte';

	interface CachedStatus {
		serverOnline: boolean;
		version: string;
		usedBytes: number;
		limitMb: number | null;
	}

	const CACHE_KEY = 'recoral_cached_server_status';
	// Last-known state shown immediately instead of defaulting to "offline"
	// while the real request is still in flight, only actually flipping to
	// red if a fresh check comes back failed.
	const cached = readLocalCache<CachedStatus | null>(CACHE_KEY, null);

	let version = $state(cached?.version ?? '');
	let serverOnline = $state<boolean | null>(cached?.serverOnline ?? null);
	let usedBytes = $state(cached?.usedBytes ?? 0);
	let limitMb = $state<number | null>(cached?.limitMb ?? null);

	let usedGb = $derived(usedBytes / 1024 ** 3);
	let limitGb = $derived(limitMb !== null ? limitMb / 1024 : null);
	let usedPercent = $derived(limitGb !== null && limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0);

	function persist() {
		writeLocalCache<CachedStatus>(CACHE_KEY, {
			serverOnline: serverOnline ?? false,
			version,
			usedBytes,
			limitMb
		});
	}

	onMount(async () => {
		try {
			const res = await api.fetch('/api/health');
			serverOnline = res.ok;
			if (res.ok) version = (await res.json()).version;
		} catch {
			serverOnline = false;
		}

		const storageRes = await api.fetch('/api/storage', { credentials: 'include' });
		if (storageRes.ok) {
			const usage = await storageRes.json();
			usedBytes = usage.usedBytes;
			limitMb = usage.limitMb;
		}

		persist();
	});
</script>

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
	<span class="flex items-center gap-2">
		{#if version}<span>server v{version}</span>{/if}
		<span>app v{APP_VERSION}</span>
	</span>
</div>
