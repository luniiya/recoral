<script lang="ts">
	import { bulkJobStore, type BulkJobKind } from '$lib/bulkJob.svelte';
	import { scale } from 'svelte/transition';

	const LABELS: Record<BulkJobKind, string> = {
		trash: 'Moving to bin',
		restore: 'Restoring',
		archive: 'Archiving',
		unarchive: 'Unarchiving',
		favorite: 'Adding to favourites',
		unfavorite: 'Removing from favourites',
		addTag: 'Adding tag',
		delete: 'Deleting forever'
	};
</script>

<!-- Nautilus-style stacked progress toasts, bottom-left, desktop only (see
     the compact single-fraction indicator that replaces the mobile Import
     button instead, this has real room for one card per concurrent job).
     Real progress, not simulated: each number here is the actual
     processed/total off server/src/bulkJobs.ts, polled live, not a fake
     counting-up animation. -->
<div class="pointer-events-none fixed bottom-6 left-6 z-30 hidden flex-col gap-2 md:flex">
	{#each bulkJobStore.jobs as job (job.id)}
		<div
			class="card pointer-events-auto flex w-64 flex-col gap-1.5 p-3 shadow-lg"
			transition:scale={{ duration: 150, start: 0.9 }}
		>
			<div class="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
				{#if job.status === 'processing'}
					<svg viewBox="0 0 24 24" fill="none" class="size-3.5 shrink-0 animate-spin text-accent-500">
						<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
						<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0 text-green-600 dark:text-green-500">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4.5 4.5L19 7.5" />
					</svg>
				{/if}
				<span class="min-w-0 flex-1 truncate">{LABELS[job.kind]}</span>
				<span class="shrink-0 tabular-nums text-gray-400">{job.processed}/{job.total}</span>
			</div>
			<div class="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
				<div
					class="h-full rounded-full bg-accent-500 transition-[width] duration-200"
					style:width="{job.total > 0 ? (job.processed / job.total) * 100 : 0}%"
				></div>
			</div>
		</div>
	{/each}
</div>
