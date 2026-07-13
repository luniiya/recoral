<script lang="ts">
	import Confetti from '$lib/components/Confetti.svelte';

	interface ExportStats {
		recordingCount: number;
		tagCount: number;
		totalDurationSeconds: number;
	}

	let downloading = $state(false);
	let done = $state(false);
	let error = $state('');
	let stats = $state<ExportStats | null>(null);

	function formatDurationStat(totalSeconds: number) {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m`;
		return `${Math.round(totalSeconds)}s`;
	}

	async function download() {
		error = '';
		downloading = true;
		try {
			const [exportRes, statsRes] = await Promise.all([
				fetch('/api/export', { credentials: 'include' }),
				fetch('/api/export/stats', { credentials: 'include' })
			]);
			if (!exportRes.ok) throw new Error('Something went wrong');

			const disposition = exportRes.headers.get('Content-Disposition') ?? '';
			const match = disposition.match(/filename="([^"]+)"/);
			const filename = match?.[1] ?? 'recoral-export.zip';

			const blob = await exportRes.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);

			if (statsRes.ok) stats = await statsRes.json();
			done = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			downloading = false;
		}
	}

	function startOver() {
		done = false;
		stats = null;
	}
</script>

<svelte:head>
	<title>recoral - Export data</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<div class="mb-6 flex items-center gap-3">
		<a
			href="/settings"
			class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
			aria-label="Back to settings"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
			</svg>
		</a>
		<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Export data</h1>
	</div>

	{#if !done}
		<div class="card flex flex-col gap-3 p-6">
			<p class="text-sm text-gray-600 dark:text-gray-300">
				Downloads your whole recoral library as one <code>.zip</code> file: every recording's audio, title,
				description, tags (with their colors), favourite/archived state, and transcript if it has one.
			</p>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				Anything sitting in your Bin is left out. This is a backup of your active library, not a way to bring
				back recordings you've already deleted.
			</p>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				The file can be brought straight back in through
				<a href="/settings/import" class="text-accent-600 hover:underline dark:text-accent-400">Import</a>, either
				on this server or a different recoral server entirely, and into this account or a different one.
			</p>
		</div>

		{#if error}
			<p class="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
		{/if}

		<div class="mt-6 flex justify-center">
			<button
				class="relative flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-90"
				onclick={download}
				disabled={downloading}
			>
				{#if downloading}
					<span
						class="size-4.5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></span>
					Preparing your download…
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 4v12m0 0 4-4m-4 4-4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
						/>
					</svg>
					Download export
				{/if}
			</button>
		</div>
	{:else}
		<div class="card p-6">
			<Confetti />
			<div class="flex flex-col items-center gap-1 pb-4 text-center">
				<span class="text-4xl">🎉</span>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Export complete!</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400">Your download should already be sitting in your browser's downloads.</p>
			</div>

			{#if stats}
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-xl bg-accent-50 p-4 text-center dark:bg-accent-500/10">
						<p class="text-2xl font-semibold text-accent-600 dark:text-accent-400">{stats.recordingCount}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">recordings backed up</p>
					</div>
					<div class="rounded-xl bg-accent-50 p-4 text-center dark:bg-accent-500/10">
						<p class="text-2xl font-semibold text-accent-600 dark:text-accent-400">
							{formatDurationStat(stats.totalDurationSeconds)}
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">of you, now safe forever</p>
					</div>
					{#if stats.tagCount > 0}
						<div class="rounded-xl bg-accent-50 p-4 text-center dark:bg-accent-500/10">
							<p class="text-2xl font-semibold text-accent-600 dark:text-accent-400">{stats.tagCount}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">tags included</p>
						</div>
					{/if}
				</div>
			{/if}

			<div class="mt-6 flex gap-2">
				<a
					href="/settings"
					class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
				>
					Back to settings
				</a>
				<button
					class="rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={startOver}
				>
					Export again
				</button>
			</div>
		</div>
	{/if}
</div>
