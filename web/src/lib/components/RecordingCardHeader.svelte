<script lang="ts">
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { formatDuration, formatTimestamp } from '$lib/format';
	import { isNativePlatform } from '$lib/platform';

	let { recording }: { recording: DisplayRecording } = $props();
</script>

<div class="flex items-baseline justify-between gap-3">
	<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
		{recording.title || formatTimestamp(recording.createdAt)}
	</span>
	<span class="flex shrink-0 items-center gap-1">
		{#if recording.favorite}
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-3.5 -translate-y-px text-accent-500">
				<path
					d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
				/>
			</svg>
		{/if}
		{#if isNativePlatform()}
			{#if recording.syncStatus === 'local' || recording.syncStatus === 'uploading'}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					class="size-3.5 text-gray-400"
					aria-label="Not backed up yet"
				>
					<title>Not backed up yet</title>
					<rect x="5" y="2" width="14" height="20" rx="3" />
					<path stroke-linecap="round" d="M11 18h2" />
				</svg>
			{:else if recording.syncStatus === 'local-and-synced'}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					class="size-3.5 text-gray-400"
					aria-label="On device and backed up"
				>
					<title>On device and backed up</title>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6.5 18a4.5 4.5 0 0 1-.5-8.975A5.5 5.5 0 0 1 16.5 7.5a4 4 0 0 1 .5 7.978"
					/>
					<path stroke-linecap="round" stroke-linejoin="round" d="m9 16 2.5 2.5L15 13" />
				</svg>
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					class="size-3.5 text-gray-400"
					aria-label="Backed up, not on this device"
				>
					<title>Backed up, not on this device</title>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6.5 18a4.5 4.5 0 0 1-.5-8.975A5.5 5.5 0 0 1 16.5 7.5a4 4 0 0 1 .5 7.978H6.5Z"
					/>
				</svg>
			{/if}
		{/if}
		<span class="text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
	</span>
</div>
