<script lang="ts">
	import type { Recording } from '@recoral/shared';
	import AudioPlayer from './AudioPlayer.svelte';
	import TagChips from './TagChips.svelte';
	import Waveform from './Waveform.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';

	interface Props {
		recording: Recording;
		onclose: () => void;
	}

	let { recording, onclose }: Props = $props();

	let activeTab = $state<'audio' | 'transcription'>('audio');
	let tagPickerOpen = $state(false);
	let playbackTime = $state(0);
	let playbackPlaying = $state(false);
	let playbackEl = $state<HTMLAudioElement | undefined>(undefined);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function downloadRecording() {
		const a = document.createElement('a');
		a.href = recordingsStore.audioUrl(recording.id);
		a.download = (recording.title || formatDate(recording.createdAt)).replace(/[\\/:*?"<>|]/g, '_');
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	$effect(() => {
		function onKeydown(event: KeyboardEvent) {
			if (!event.shiftKey || event.key.toLowerCase() !== 'd') return;
			const target = event.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
			event.preventDefault();
			downloadRecording();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between px-5 py-3">
		<button
			class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
			aria-label="Close"
			onclick={onclose}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>

		<div class="flex items-center gap-1">
			<button
				class="flex size-8 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-white/5
					{recording.favorite ? 'text-accent-500' : 'text-gray-400 hover:text-accent-500'}"
				aria-label={recording.favorite ? 'Unfavourite' : 'Favourite'}
				title={recording.favorite ? 'Unfavourite' : 'Favourite'}
				onclick={() => recordingsStore.toggleFavorite(recording.id)}
			>
				<svg
					viewBox="0 0 24 24"
					fill={recording.favorite ? 'currentColor' : 'none'}
					stroke="currentColor"
					stroke-width="1.8"
					class="size-4"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
					/>
				</svg>
			</button>
			<button
				class="flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-accent-600 dark:hover:bg-white/5"
				aria-label="Download"
				title="Download (Shift+D)"
				onclick={downloadRecording}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4v12m0 0 4-4m-4 4-4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
					/>
				</svg>
			</button>
			<button
				class="flex size-8 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-white/5
					{recording.archivedAt ? 'text-accent-500' : 'text-gray-400 hover:text-accent-600'}"
				aria-label={recording.archivedAt ? 'Unarchive' : 'Archive'}
				title={recording.archivedAt ? 'Unarchive' : 'Archive'}
				onclick={() => {
					if (recording.archivedAt) recordingsStore.unarchive(recording.id);
					else recordingsStore.archive(recording.id);
					onclose();
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 4h16v4H4V4Zm1 4v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 13h4"
					/>
				</svg>
			</button>
			<button
				class="flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/5"
				aria-label="Move to bin"
				title="Move to bin"
				onclick={() => {
					recordingsStore.trash(recording.id);
					onclose();
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7"
					/>
				</svg>
			</button>
		</div>
	</div>

	<div class="flex flex-col gap-3 px-5 py-4">
		<div class="flex items-baseline justify-between gap-3">
			<input
				class="min-w-0 flex-1 truncate bg-transparent text-lg font-semibold text-gray-900 outline-none dark:text-gray-100"
				placeholder={formatDate(recording.createdAt)}
				value={recording.title}
				onchange={(e) => recordingsStore.updateTitle(recording.id, e.currentTarget.value)}
				aria-label="Recording title"
			/>
			{#if recording.title}
				<span class="shrink-0 text-xs text-gray-400">{formatDate(recording.createdAt)}</span>
			{/if}
		</div>

		<input
			class="w-full bg-transparent text-sm text-gray-500 outline-none dark:text-gray-400"
			placeholder="Add a description…"
			value={recording.description}
			onchange={(e) => recordingsStore.updateDescription(recording.id, e.currentTarget.value)}
			aria-label="Recording description"
		/>

		<div class="relative flex flex-wrap items-center gap-1.5">
			<TagChips
				tags={tagsStore.list.filter((t) => recording.tagIds.includes(t.id))}
				allTags={tagsStore.list}
				selected={recording.tagIds}
				ontoggle={(tagId) => recordingsStore.toggleRecordingTag(recording.id, tagId)}
			/>
			<button
				class="rounded-full px-2.5 py-1 text-xs text-gray-400 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={() => (tagPickerOpen = !tagPickerOpen)}
			>
				+ tag
			</button>

			{#if tagPickerOpen}
				<button
					class="fixed inset-0 z-10 cursor-default"
					aria-label="Close tag picker"
					onclick={() => (tagPickerOpen = false)}
				></button>
				<div class="card absolute top-full left-0 z-20 mt-1 w-56 p-3">
					<TagChips
						tags={tagsStore.list}
						allTags={tagsStore.list}
						selected={recording.tagIds}
						ontoggle={(tagId) => recordingsStore.toggleRecordingTag(recording.id, tagId)}
					/>
				</div>
			{/if}
		</div>
	</div>

	<div class="mx-5 my-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-accent-50 dark:bg-accent-500/10">
		<div class="flex-1 overflow-y-auto px-5 py-6">
			{#if activeTab === 'audio'}
				<div class="flex h-full w-full items-center">
					<Waveform
						src={recordingsStore.audioUrl(recording.id)}
						currentTime={playbackTime}
						playing={playbackPlaying}
						audioEl={playbackEl}
					/>
				</div>
			{:else if recording.transcript}
				<p class="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{recording.transcript}</p>
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-gray-400">No transcription yet</div>
			{/if}
		</div>

		<div class="flex justify-center pb-3">
			<div class="inline-flex rounded-full bg-black/5 p-1 dark:bg-white/10">
				<button
					class="rounded-full px-4 py-1.5 text-sm font-medium transition
						{activeTab === 'audio'
						? 'bg-accent-500 text-white'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
					onclick={() => (activeTab = 'audio')}
				>
					Audio
				</button>
				<button
					class="rounded-full px-4 py-1.5 text-sm font-medium transition
						{activeTab === 'transcription'
						? 'bg-accent-500 text-white'
						: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
					onclick={() => (activeTab = 'transcription')}
				>
					Transcription
				</button>
			</div>
		</div>
	</div>

	<div class="px-5 py-4">
		<AudioPlayer
			src={recordingsStore.audioUrl(recording.id)}
			bind:currentTime={playbackTime}
			bind:playing={playbackPlaying}
			bind:audioEl={playbackEl}
		/>
	</div>
</div>
