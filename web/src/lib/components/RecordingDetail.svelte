<script lang="ts">
	import type { Tag } from '@recoral/shared';
	import AudioPlayer from './AudioPlayer.svelte';
	import TagChip from './TagChip.svelte';
	import TagChips from './TagChips.svelte';
	import TagRemoveConfirm from './TagRemoveConfirm.svelte';
	import Waveform from './Waveform.svelte';
	import { formatTimestamp, recordingDisplayTitle } from '$lib/format';
	import { isNativePlatform } from '$lib/platform';
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { parentTag, tagBreadcrumb } from '$lib/tagPath';
	import StatusBarSpacer from './StatusBarSpacer.svelte';

	interface Props {
		recording: DisplayRecording;
		onclose: () => void;
	}

	let { recording, onclose }: Props = $props();

	// Not synced to the server yet (recorded offline, or upload hasn't landed
	// yet): favorite/archive/tags need a real server recording to attach to,
	// so those controls are hidden until it syncs. Deleting is still allowed,
	// just permanently (there's no bin for something not even uploaded yet).
	let isLocal = $derived(recording.syncStatus === 'local');
	let hasLocalFile = $derived(!!recordingsStore.localFilePath(recording.id));

	let activeTab = $state<'audio' | 'transcription'>('audio');
	let tagPickerOpen = $state(false);
	let pendingRemoveTag = $state<Tag | null>(null);

	function searchByTag(tag: Tag) {
		recordingsStore.setTagFilter(tag.id);
		onclose();
	}
	let playbackTime = $state(0);
	let playbackPlaying = $state(false);
	let playbackEl = $state<HTMLAudioElement | undefined>(undefined);
	let transcribeError = $state('');
	let retrying = $state(false);
	let downloading = $state(false);
	let sharing = $state(false);

	function retryTranscription() {
		transcribeError = '';
		retrying = true;
		recordingsStore
			.retryTranscription(recording.id)
			.then((result) => {
				if (result.error) transcribeError = result.error;
			})
			.finally(() => (retrying = false));
	}

	// While a transcript is in flight, poll this one recording so the tab
	// updates on its own once the background job finishes, no manual refresh
	// needed. Not local-storage-cache-worthy or worth a websocket for
	// something this infrequent.
	$effect(() => {
		if (recording.transcriptStatus !== 'pending' && recording.transcriptStatus !== 'processing') return;
		const interval = setInterval(() => recordingsStore.refreshOne(recording.id), 3000);
		return () => clearInterval(interval);
	});

	function downloadRecording() {
		if (isNativePlatform()) {
			// "Download" on the phone means "make it play offline", not a
			// browser Save As, caches the actual file in the app's own storage.
			if (hasLocalFile || downloading) return;
			downloading = true;
			recordingsStore
				.downloadForOffline(recording.id)
				.catch((err) => console.error('[RecordingDetail] Failed to download for offline use:', err))
				.finally(() => (downloading = false));
			return;
		}
		const a = document.createElement('a');
		a.href = recordingsStore.audioUrl(recording.id);
		a.download = recordingDisplayTitle(recording).replace(/[\\/:*?"<>|]/g, '_');
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	async function shareRecording() {
		if (sharing) return;
		sharing = true;
		try {
			let filePath = recordingsStore.localFilePath(recording.id);
			if (!filePath) {
				await recordingsStore.downloadForOffline(recording.id);
				filePath = recordingsStore.localFilePath(recording.id);
			}
			if (!filePath) return;
			const { Share } = await import('@capacitor/share');
			await Share.share({
				title: recordingDisplayTitle(recording),
				files: [filePath]
			});
		} catch (err) {
			console.error('[RecordingDetail] Failed to share recording:', err);
		} finally {
			sharing = false;
		}
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
	<div class="md:hidden">
		<StatusBarSpacer />
	</div>
	<div class="flex items-center justify-between px-5 py-3">
		<button
			class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
			aria-label="Close"
			onclick={onclose}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 md:hidden">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
			</svg>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="hidden size-4 md:block">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>

		<div class="flex items-center gap-1">
			{#if !isLocal && !isNativePlatform()}
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
			{/if}
			<button
				class="flex size-8 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-white/5
					{isNativePlatform() && hasLocalFile ? 'text-accent-500' : 'text-gray-400 hover:text-accent-600'}"
				aria-label={isNativePlatform() ? (hasLocalFile ? 'Downloaded for offline use' : 'Download for offline use') : 'Download'}
				title={isNativePlatform()
					? hasLocalFile
						? 'Downloaded for offline use'
						: 'Download for offline use'
					: 'Download (Shift+D)'}
				disabled={isNativePlatform() && (hasLocalFile || downloading)}
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
			{#if isNativePlatform()}
				<button
					class="flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-accent-600 dark:hover:bg-white/5"
					aria-label="Share"
					title="Share"
					disabled={sharing}
					onclick={shareRecording}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
						<circle cx="18" cy="5" r="2.5" />
						<circle cx="6" cy="12" r="2.5" />
						<circle cx="18" cy="19" r="2.5" />
						<path stroke-linecap="round" d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4" />
					</svg>
				</button>
			{/if}
			{#if !isLocal}
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
			{/if}
			<button
				class="flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/5"
				aria-label={isLocal ? 'Delete' : 'Move to bin'}
				title={isLocal ? 'Delete' : 'Move to bin'}
				onclick={() => {
					if (isLocal) {
						if (!confirm('Delete this recording? It has not been uploaded yet, this cannot be undone.')) return;
						recordingsStore.deleteForever(recording.id);
					} else {
						recordingsStore.trash(recording.id);
					}
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
				placeholder={formatTimestamp(recording.createdAt)}
				value={recording.title}
				onchange={(e) => recordingsStore.updateTitle(recording.id, e.currentTarget.value)}
				aria-label="Recording title"
			/>
			{#if recording.title}
				<span class="shrink-0 text-xs text-gray-400">{formatTimestamp(recording.createdAt)}</span>
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
			{#each tagsStore.list.filter((t) => recording.tagIds.includes(t.id)) as tag (tag.id)}
				<TagChip
					{tag}
					label={tagBreadcrumb(tag.name)}
					parentHue={parentTag(tag, tagsStore.list)?.hue ?? null}
					selected
					onclick={() => searchByTag(tag)}
					onholddelete={() => (pendingRemoveTag = tag)}
				/>
			{/each}
			{#if tagsStore.list.length > 0 && !isLocal}
				<button
					class="rounded-full px-2.5 py-1 text-xs text-gray-400 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={() => (tagPickerOpen = !tagPickerOpen)}
				>
					+ tag
				</button>
			{/if}

			{#if tagPickerOpen && tagsStore.list.length > 0 && !isLocal}
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

		{#if pendingRemoveTag}
			<TagRemoveConfirm
				label={tagBreadcrumb(pendingRemoveTag.name)}
				onconfirm={() => {
					if (pendingRemoveTag) recordingsStore.toggleRecordingTag(recording.id, pendingRemoveTag.id);
					pendingRemoveTag = null;
				}}
				oncancel={() => (pendingRemoveTag = null)}
			/>
		{/if}
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
				<div class="flex h-full flex-col gap-3">
					<p class="flex-1 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{recording.transcript}</p>
					{#if !isLocal}
						<div class="flex items-center justify-end gap-2 text-xs">
							{#if recording.transcriptStatus === 'pending' || recording.transcriptStatus === 'processing'}
								<span class="flex items-center gap-1.5 text-gray-400">
									<svg viewBox="0 0 24 24" fill="none" class="size-3.5 animate-spin text-accent-500">
										<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
										<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
									</svg>
									Retranscribing…
								</span>
							{:else}
								{#if transcribeError}<span class="text-red-500 dark:text-red-400">{transcribeError}</span>{/if}
								<button
									class="rounded-full px-3 py-1 font-semibold text-accent-600 ring-1 ring-accent-200 transition hover:bg-accent-50 disabled:opacity-60 dark:text-accent-400 dark:ring-accent-500/30 dark:hover:bg-accent-500/10"
									onclick={retryTranscription}
									disabled={retrying}
								>
									{retrying ? 'Starting…' : 'Retranscribe'}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{:else if recording.transcriptStatus === 'pending' || recording.transcriptStatus === 'processing'}
				<div class="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
					<svg viewBox="0 0 24 24" fill="none" class="size-5 animate-spin text-accent-500">
						<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-opacity="0.25" />
						<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
					</svg>
					{recording.transcriptStatus === 'processing' ? 'Transcribing…' : 'Queued for transcription…'}
				</div>
			{:else if recording.transcriptStatus === 'failed'}
				<div class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
					<p class="text-gray-400">Transcription failed</p>
					{#if transcribeError}<p class="text-xs text-red-500 dark:text-red-400">{transcribeError}</p>{/if}
					<button
						class="mt-1 rounded-full px-4 py-1.5 text-xs font-semibold text-accent-600 ring-1 ring-accent-200 transition hover:bg-accent-50 disabled:opacity-60 dark:text-accent-400 dark:ring-accent-500/30 dark:hover:bg-accent-500/10"
						onclick={retryTranscription}
						disabled={retrying}
					>
						{retrying ? 'Retrying…' : 'Retry'}
					</button>
				</div>
			{:else}
				<div class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
					<p>No transcription yet</p>
					{#if transcribeError}<p class="text-xs text-red-500 dark:text-red-400">{transcribeError}</p>{/if}
					{#if !isLocal}
						<button
							class="mt-1 rounded-full px-4 py-1.5 text-xs font-semibold text-accent-600 ring-1 ring-accent-200 transition hover:bg-accent-50 disabled:opacity-60 dark:text-accent-400 dark:ring-accent-500/30 dark:hover:bg-accent-500/10"
							onclick={retryTranscription}
							disabled={retrying}
						>
							{retrying ? 'Starting…' : 'Transcribe'}
						</button>
					{/if}
				</div>
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

	<div
		class="px-5 pt-4 pb-[calc(1rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] md:pb-4"
	>
		<AudioPlayer
			src={recordingsStore.audioUrl(recording.id)}
			title={recordingDisplayTitle(recording)}
			bind:currentTime={playbackTime}
			bind:playing={playbackPlaying}
			bind:audioEl={playbackEl}
			favorite={recording.favorite}
			onToggleFavorite={isLocal ? undefined : () => recordingsStore.toggleFavorite(recording.id)}
		/>
	</div>
</div>
