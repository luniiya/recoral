<script lang="ts">
	import type { Settings } from '@recoral/shared';
	import Toggle from '$lib/components/Toggle.svelte';
	import { api } from '$lib/api.svelte';
	import { onMount } from 'svelte';

	let settings = $state<Settings | null>(null);
	let loading = $state(true);

	onMount(async () => {
		const res = await api.fetch('/api/settings');
		if (res.ok) settings = await res.json();
		loading = false;
	});

	async function patchSettings(updates: Partial<Settings>) {
		const res = await api.fetch('/api/admin/settings', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(updates)
		});
		if (res.ok) settings = await res.json();
	}
</script>

<svelte:head>
	<title>recoral - Transcription</title>
</svelte:head>

<div class="mx-auto h-full w-full max-w-xl overflow-y-auto px-6 pb-24 md:pb-10">
{#if !loading && settings}
	<div class="card flex flex-col gap-5 p-5">
		<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Transcription</h2>

		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-sm text-gray-900 dark:text-gray-100">Transcription</p>
				<p class="text-xs text-gray-400">
					Requires the transcription service (whisper.cpp) running alongside the server.
				</p>
			</div>
			<Toggle
				checked={settings.transcriptionEnabled}
				onchange={(checked) => patchSettings({ transcriptionEnabled: checked })}
				label="Transcription"
			/>
		</div>

		{#if settings.transcriptionEnabled}
			<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				Model
				<select
					value={settings.transcriptionModel}
					class="rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
					onchange={(e) =>
						patchSettings({ transcriptionModel: e.currentTarget.value as Settings['transcriptionModel'] })}
				>
					<option value="tiny">Tiny (fastest, least accurate)</option>
					<option value="base">Base (fast)</option>
					<option value="small">Small (balanced, recommended)</option>
					<option value="medium">Medium (slower, more accurate)</option>
					<option value="large">Large (slowest, most accurate)</option>
				</select>
			</label>
		{/if}
	</div>
{/if}
</div>
