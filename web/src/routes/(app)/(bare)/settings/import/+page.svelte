<script lang="ts">
	import BackButton from '$lib/components/BackButton.svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import StatCard from '$lib/components/StatCard.svelte';

	type Step = 'format' | 'upload' | 'confirm' | 'progress';
	type Format = 'takeout' | 'recoral';

	interface ImportJob {
		id: string;
		status: 'processing' | 'done' | 'failed';
		total: number;
		processed: number;
		imported: number;
		duplicates: number;
		errors: number;
		errorMessages: string[];
		quotaReached: boolean;
		totalDurationSeconds: number;
		transcribedCount: number;
		earliestDate: string | null;
		latestDate: string | null;
	}

	let step = $state<Step>('format');
	let format = $state<Format | null>(null);
	let selectedFile = $state<File | null>(null);
	let dragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let uploadError = $state('');
	let job = $state<ImportJob | null>(null);
	let pollHandle: ReturnType<typeof setInterval> | null = null;

	function chooseFormat(chosen: Format) {
		format = chosen;
		step = 'upload';
	}

	function onFileSelected(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			selectedFile = file;
			step = 'confirm';
		}
		(event.target as HTMLInputElement).value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files[0];
		if (file) {
			selectedFile = file;
			step = 'confirm';
		}
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDurationStat(totalSeconds: number) {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m`;
		return `${Math.round(totalSeconds)}s`;
	}

	function formatDateStat(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// The upload just hands the file to the server; every bit of parsing,
	// date/transcript extraction, and recording creation happens server-side
	// (see server/src/takeoutImport.ts and server/src/recoralImport.ts) so
	// this stays a thin client regardless of format.
	async function confirmImport() {
		if (!selectedFile || !format) return;
		uploadError = '';
		step = 'progress';

		const form = new FormData();
		form.append('file', selectedFile);

		const res = await fetch(`/api/import/${format}`, { method: 'POST', credentials: 'include', body: form });
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			uploadError = body.error ?? 'Something went wrong';
			step = 'confirm';
			return;
		}

		const { jobId } = await res.json();
		pollJob(jobId);
	}

	function pollJob(jobId: string) {
		if (pollHandle) clearInterval(pollHandle);
		pollHandle = setInterval(async () => {
			const res = await fetch(`/api/import/${format}/${jobId}`, { credentials: 'include' });
			if (!res.ok) return;
			job = await res.json();
			if (job && job.status !== 'processing' && pollHandle) {
				clearInterval(pollHandle);
				pollHandle = null;
			}
		}, 1000);
	}

	function startOver() {
		step = 'format';
		format = null;
		selectedFile = null;
		job = null;
		uploadError = '';
	}

	let doneSummary = $derived.by(() => {
		if (!job) return '';
		let text = `Done. Imported ${job.imported}`;
		if (job.duplicates > 0) {
			text += `, skipped ${job.duplicates} duplicate${job.duplicates === 1 ? '' : 's'}`;
		}
		if (job.errors > 0) text += `, ${job.errors} failed`;
		return `${text}.`;
	});
</script>

<svelte:head>
	<title>recoral - Import data</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<div class="mb-6 flex items-center gap-3">
		{#if step === 'format'}
			<BackButton href="/settings" label="Back to settings" />
		{:else if step !== 'progress'}
			<BackButton onclick={() => (step = step === 'confirm' ? 'upload' : 'format')} />
		{/if}
		<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Import data</h1>
	</div>

	{#if step === 'format'}
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">What would you like to import?</p>
		<div class="flex flex-col gap-3">
			<button
				class="card flex w-full items-center gap-4 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
				onclick={() => chooseFormat('recoral')}
			>
				<div class="flex size-10 shrink-0 items-center justify-center">
					<img src="/logo.png" alt="" class="size-9 rounded-full object-cover" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">recoral export</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">A backup made with recoral's own Export button</p>
				</div>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0 text-gray-300 dark:text-gray-600">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
				</svg>
			</button>
			<button
				class="card flex w-full items-center gap-4 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
				onclick={() => chooseFormat('takeout')}
			>
				<div class="flex size-10 shrink-0 items-center justify-center">
					<img src="/google-recorder.svg" alt="" class="size-9" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">Google Takeout</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">Google Recorder's data export</p>
				</div>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0 text-gray-300 dark:text-gray-600">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
				</svg>
			</button>
		</div>
	{:else if step === 'upload'}
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
			{#if format === 'takeout'}
				Upload the <code>.zip</code> file Google emailed you from Takeout.
			{:else}
				Upload a <code>.zip</code> file exported from recoral's own Settings &gt; Export.
			{/if}
		</p>
		<button
			type="button"
			class="flex w-full cursor-pointer flex-col items-center rounded-xl border-2 border-dashed text-center transition
				{dragging ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10' : 'border-gray-200 dark:border-white/10'}"
			style="padding-top: 96px; padding-bottom: 96px; padding-left: 40px; padding-right: 40px; gap: 14px;"
			aria-label="Import drop zone, click or drop a file here"
			onclick={() => fileInput?.click()}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
		>
			<svg
				width="32"
				height="32"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				class="shrink-0 text-gray-300 dark:text-gray-600"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
				/>
			</svg>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Drag your Takeout <code>.zip</code> here, or <span class="text-accent-600 dark:text-accent-400">choose a file</span>
			</p>
		</button>
		<input bind:this={fileInput} type="file" accept=".zip" class="hidden" onchange={onFileSelected} />
	{:else if step === 'confirm' && selectedFile}
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Ready to import this file?</p>
		<div class="card mb-4 flex items-center gap-3 p-4">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6 shrink-0 text-gray-400">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
				/>
			</svg>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
				<p class="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
			</div>
		</div>
		{#if uploadError}
			<p class="mb-4 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
		{/if}
		<div class="flex gap-2">
			<button
				class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
				onclick={confirmImport}
			>
				Confirm import
			</button>
			<button
				class="rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={() => (step = 'upload')}
			>
				Choose a different file
			</button>
		</div>
	{:else if step === 'progress'}
		<div class="card p-6">
			{#if !job || job.status === 'processing'}
				<div class="mb-2 flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
					<span>Importing…</span>
					{#if job}<span class="tabular-nums">{job.processed} / {job.total}</span>{/if}
				</div>
				<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
					<div
						class="h-full rounded-full bg-accent-500 transition-[width]"
						style:width="{job && job.total ? (job.processed / job.total) * 100 : 0}%"
					></div>
				</div>
			{:else if job.status === 'done'}
				<Confetti />
				<div class="flex flex-col items-center gap-1 pb-4 text-center">
					<span class="text-4xl">🎉</span>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Import complete!</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">{doneSummary}</p>
				</div>

				{#if job.imported > 0}
					<div class="grid grid-cols-2 gap-3">
						<StatCard value={job.imported} label="recordings rescued" />
						<StatCard value={formatDurationStat(job.totalDurationSeconds)} label="of you, now safe forever" />
						{#if job.transcribedCount > 0}
							<StatCard value={job.transcribedCount} label="already had a transcript" />
						{/if}
						{#if job.earliestDate && job.latestDate}
							<div class="rounded-xl bg-accent-50 p-4 text-center dark:bg-accent-500/10">
								<p class="flex items-center justify-center gap-1.5 text-sm font-semibold text-accent-600 dark:text-accent-400">
									<span>{formatDateStat(job.earliestDate)}</span>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4 12h16m0 0-5-5m5 5-5 5" />
									</svg>
									<span>{formatDateStat(job.latestDate)}</span>
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">oldest to newest</p>
							</div>
						{/if}
						{#if job.duplicates > 0}
							<StatCard value={job.duplicates} label="already in your library, skipped" tone="gray" />
						{/if}
						{#if job.errors > 0}
							<StatCard value={job.errors} label="couldn't be imported" tone="gray" />
						{/if}
					</div>
				{/if}

				{#if job.quotaReached}
					<p class="mt-4 text-sm text-red-600 dark:text-red-400">
						Stopped early: storage quota reached before the whole export could be imported.
					</p>
				{/if}
				<div class="mt-6 flex justify-center gap-2">
					<a
						href="/"
						class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
					>
						View recordings
					</a>
					<button
						class="rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
						onclick={startOver}
					>
						Import another file
					</button>
				</div>
			{:else if job.status === 'failed'}
				<p class="text-sm text-red-600 dark:text-red-400">
					Import failed{#if job.errorMessages[0]}: {job.errorMessages[0]}{/if}
				</p>
				<button
					class="mt-4 rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
					onclick={startOver}
				>
					Try again
				</button>
			{/if}
		</div>
	{/if}
</div>
