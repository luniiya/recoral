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
				<svg viewBox="0 0 512 512" class="size-3.5 text-gray-400" aria-label="On device and backed up">
					<title>On device and backed up</title>
					<path
						fill="currentColor"
						d="M344.381,143.771C254.765,56.017,102.37,103.776,79.825,227.7c-31.849,4.598-59.138,25.445-72.018,55.076    c-0.016,0.035-0.032,0.07-0.047,0.107c-26.687,61.602,18.784,130.232,85.51,130.232h282.267    c75.246,0,136.463-61.216,136.463-136.462C512,189.241,430.314,123.682,344.381,143.771z M375.537,381.12H93.271    c-69.246,0-84.534-98.263-18.714-119.456c14.753-4.65,43.01-7.348,74.38,21.892c6.464,6.024,16.586,5.667,22.61-0.794    c6.024-6.464,5.668-16.586-0.794-22.61c-17.93-16.712-38.071-27.33-58.484-31.453c22.034-99.077,147.374-131.851,215.247-56.305    c4.189,4.661,10.714,6.451,16.693,4.57c67.272-21.117,135.795,29.374,135.795,99.69    C480.005,334.256,433.141,381.12,375.537,381.12z"
					/>
					<path fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" d="M200,300 L250,345 L350,250" />
				</svg>
			{:else}
				<svg viewBox="0 0 512 512" class="size-3.5 text-gray-400" aria-label="Backed up, not on this device">
					<title>Backed up, not on this device</title>
					<path
						fill="currentColor"
						d="M344.381,143.771C254.765,56.017,102.37,103.776,79.825,227.7c-31.849,4.598-59.138,25.445-72.018,55.076    c-0.016,0.035-0.032,0.07-0.047,0.107c-26.687,61.602,18.784,130.232,85.51,130.232h282.267    c75.246,0,136.463-61.216,136.463-136.462C512,189.241,430.314,123.682,344.381,143.771z M375.537,381.12H93.271    c-69.246,0-84.534-98.263-18.714-119.456c14.753-4.65,43.01-7.348,74.38,21.892c6.464,6.024,16.586,5.667,22.61-0.794    c6.024-6.464,5.668-16.586-0.794-22.61c-17.93-16.712-38.071-27.33-58.484-31.453c22.034-99.077,147.374-131.851,215.247-56.305    c4.189,4.661,10.714,6.451,16.693,4.57c67.272-21.117,135.795,29.374,135.795,99.69    C480.005,334.256,433.141,381.12,375.537,381.12z"
					/>
				</svg>
			{/if}
		{/if}
		<span class="text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
	</span>
</div>
