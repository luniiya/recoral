<script lang="ts">
	import { liveRecordingStore } from '$lib/liveRecording.svelte';
	import LiveWaveform from './LiveWaveform.svelte';
	import StatusBarSpacer from './StatusBarSpacer.svelte';

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
	<div class="md:hidden">
		<StatusBarSpacer />
	</div>
	<div class="flex flex-col gap-3 px-5 py-4">
		<input
			class="min-w-0 truncate bg-transparent text-lg font-semibold text-gray-900 outline-none disabled:opacity-60 dark:text-gray-100"
			placeholder="Untitled recording"
			value={liveRecordingStore.title}
			oninput={(e) => liveRecordingStore.setTitle(e.currentTarget.value)}
			aria-label="Recording title"
			disabled={saving}
		/>
		<input
			class="w-full bg-transparent text-sm text-gray-500 outline-none disabled:opacity-60 dark:text-gray-400"
			placeholder="Add a description…"
			value={liveRecordingStore.description}
			oninput={(e) => liveRecordingStore.setDescription(e.currentTarget.value)}
			aria-label="Recording description"
			disabled={saving}
		/>
	</div>

	{#if !saving}
		<div class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span class="size-2 animate-pulse rounded-full bg-red-500"></span>
			<span class="tabular-nums">{formatDuration(elapsedSeconds)}</span>
		</div>
	{/if}

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

	{#if !saving}
		<div
			class="flex justify-center pb-[calc(2rem+var(--android-nav-bottom-inset,env(safe-area-inset-bottom)))] md:pb-8"
		>
			<button
				class="flex size-16 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
				aria-label="Stop recording"
				title="Stop recording"
				onclick={onStop}
			>
				<span class="size-5 rounded-sm bg-white"></span>
			</button>
		</div>
	{/if}
</div>
