<script lang="ts">
	import { APP_VERSION } from '@recoral/shared';
	import { api } from '$lib/api.svelte';
	import { auth } from '$lib/auth.svelte';
	import { readLocalCache, writeLocalCache } from '$lib/localCache';
	import { isNativePlatform } from '$lib/platform';
	import { vimZone } from '$lib/vimZone.svelte';
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
		// Bounded: otherwise an unreachable server leaves this dot showing
		// stale cached state for however long the OS network stack takes to
		// give up on its own (observed anywhere from milliseconds to minutes),
		// defeating the point of an at-a-glance status indicator.
		try {
			const res = await api.fetch('/api/health', { signal: AbortSignal.timeout(8000) });
			serverOnline = res.ok;
			if (res.ok) version = (await res.json()).version;
		} catch {
			serverOnline = false;
		}

		try {
			const storageRes = await api.fetch('/api/storage', {
				credentials: 'include',
				signal: AbortSignal.timeout(8000)
			});
			if (storageRes.ok) {
				const usage = await storageRes.json();
				usedBytes = usage.usedBytes;
				limitMb = usage.limitMb;
			}
		} catch {
			// Keep whatever storage numbers were last cached.
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
	{#if vimZone.enabled}
		<!-- The easter egg, on purpose: this is meant to look like it crashed in
		     from a completely different, un-flat, un-neutral UI (the real vim
		     logo, real vim's own default Normal-mode statusline green), not
		     blend in with the rest of this row. -->
		<span class="flex items-center gap-1.5">
			<svg viewBox="0 0 32 32" class="size-4 shrink-0">
				<path
					fill="#159532"
					d="m 15.999564,1.0000138 c -0.785749,0 -1.572023,0.2928722 -2.15939,0.8802248 L 1.8802118,13.841534 c -1.17473393,1.174704 -1.17306751,3.140583 0.00171,4.315288 L 13.841888,30.118117 c 1.174734,1.174706 3.142365,1.176372 4.317099,0.0017 L 30.11895,18.158537 c 1.174733,-1.174705 1.174734,-3.142267 0,-4.316972 L 18.158956,1.8802386 C 17.571589,1.2928861 16.785314,1.0000138 15.999564,1.0000138 Z"
				/>
				<path
					fill="#e4e4e4"
					fill-rule="evenodd"
					d="M 4.5,4 C 3.669,4 3,4.669 3,5.5 3,6.331 3.669,7 4.5,7 L 5,7 5,24 c 0.00105,2.671911 3.2311099,4.009763 5.121094,2.121094 C 16.510863,19.531437 23.205176,13.215584 29.539062,6.5820312 29.822998,6.3094163 30,5.9265282 30,5.5 30,4.669 29.331,4 28.5,4 l -7,0 C 20.669,4 20,4.669 20,5.5 c 0,0.6123441 0.365014,1.1355819 0.888672,1.3691406 L 11,16.757812 11,7 11.5,7 C 12.331,7 13,6.331 13,5.5 13,4.669 12.331,4 11.5,4 Z"
				/>
			</svg>
			<span class="font-mono text-[11px] font-bold text-green-600 dark:text-green-500">NORMAL</span>
		</span>
	{:else}
		<span class="flex items-center gap-1.5">
			<span class="size-1.5 rounded-full {serverOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
			{serverOnline ? 'Server online' : 'Server unreachable'}
		</span>
	{/if}
	<span class="flex items-center gap-2">
		{#if version}<span>v{version}</span>{/if}
		{#if isNativePlatform()}
			<span class="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-semibold text-white">
				v{APP_VERSION} (app)
			</span>
		{/if}
	</span>
</div>
