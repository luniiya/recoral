<script lang="ts">
	import LiveWaveform from './LiveWaveform.svelte';

	interface Props {
		stream: MediaStream | null;
		elapsedSeconds: number;
		saving: boolean;
		onStop: () => void;
	}

	let { stream, elapsedSeconds, saving, onStop }: Props = $props();

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between px-5 py-3">
		<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			{#if !saving}
				<span class="size-2 animate-pulse rounded-full bg-red-500"></span>
			{/if}
			<span class="tabular-nums">{formatDuration(elapsedSeconds)}</span>
		</div>

		{#if !saving}
			<button
				class="flex size-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40"
				aria-label="Stop recording"
				title="Stop recording"
				onclick={onStop}
			>
				<span class="size-3.5 rounded-sm bg-red-500"></span>
			</button>
		{/if}
	</div>

	<div
		class="mx-5 my-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-accent-50 dark:bg-accent-500/10"
	>
		{#if saving}
			<div
				class="size-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent"
				aria-label="Saving"
			></div>
			<p class="text-sm text-gray-500 dark:text-gray-400">Saving…</p>
		{:else if stream}
			<LiveWaveform {stream} />
			<p class="text-sm text-gray-500 dark:text-gray-400">Recording…</p>
		{/if}
	</div>
</div>
