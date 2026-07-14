<script lang="ts">
	import { api } from '$lib/api.svelte';
	import { auth } from '$lib/auth.svelte';
	import { onMount } from 'svelte';

	let version = $state('');
	let serverOnline = $state<boolean | null>(null);
	let usedBytes = $state(0);
	let limitMb = $state<number | null>(null);

	let usedGb = $derived(usedBytes / 1024 ** 3);
	let limitGb = $derived(limitMb !== null ? limitMb / 1024 : null);
	let usedPercent = $derived(limitGb !== null && limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0);

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
	{#if version}<span>v{version}</span>{/if}
</div>
