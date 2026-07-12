<script lang="ts">
	import TagChips from '$lib/components/TagChips.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';

	let isRecording = $state(false);
	let elapsedSeconds = $state(0);
	let openTagPickerId = $state<string | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let timerHandle: ReturnType<typeof setInterval> | null = null;
	let recordingStart = 0;

	let visibleRecordings = $derived(
		recordingsStore.active.filter((r) => {
			const query = recordingsStore.search.trim().toLowerCase();
			const matchesQuery =
				!query || r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query);

			const filterTags = recordingsStore.selectedTagIds;
			const matchesTags = filterTags.length === 0 || filterTags.some((id) => r.tagIds.includes(id));

			return matchesQuery && matchesTags;
		})
	);

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatTimestamp(date: Date) {
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	async function startRecording() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		chunks = [];
		mediaRecorder = new MediaRecorder(stream);

		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};

		mediaRecorder.onstop = () => {
			const blob = new Blob(chunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' });
			const url = URL.createObjectURL(blob);
			const durationSeconds = (Date.now() - recordingStart) / 1000;

			recordingsStore.add({
				title: `Recording ${recordingsStore.active.length + 1}`,
				description: '',
				url,
				createdAt: new Date(),
				durationSeconds
			});

			for (const track of stream.getTracks()) track.stop();
		};

		recordingStart = Date.now();
		mediaRecorder.start();
		isRecording = true;
		elapsedSeconds = 0;
		timerHandle = setInterval(() => {
			elapsedSeconds = (Date.now() - recordingStart) / 1000;
		}, 200);
	}

	function stopRecording() {
		mediaRecorder?.stop();
		isRecording = false;
		if (timerHandle) clearInterval(timerHandle);
	}

	function toggleRecording() {
		if (isRecording) stopRecording();
		else startRecording();
	}
</script>

<svelte:head>
	<title>recoral</title>
</svelte:head>

<div class="flex flex-col items-center gap-3 pb-10">
	<button
		class="flex size-16 items-center justify-center rounded-full text-white shadow-sm transition
			{isRecording ? 'bg-accent-700' : 'bg-accent-500 hover:bg-accent-600'}"
		onclick={toggleRecording}
		aria-label={isRecording ? 'Stop recording' : 'Start recording'}
	>
		{#if isRecording}
			<span class="size-4 rounded-sm bg-white"></span>
		{:else}
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-6">
				<path
					d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z"
				/>
			</svg>
		{/if}
	</button>
	<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
		{#if isRecording}
			<span class="size-1.5 animate-pulse rounded-full bg-accent-500"></span>
		{/if}
		<span class="tabular-nums">{isRecording ? formatDuration(elapsedSeconds) : 'Tap to record'}</span>
	</div>
</div>

<ul class="flex flex-col gap-3">
	{#each visibleRecordings as recording (recording.id)}
		<li class="card p-4">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<input
					class="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-gray-900 outline-none focus:underline dark:text-gray-100"
					bind:value={recording.title}
					aria-label="Recording title"
				/>
				<span class="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
				<button
					class="flex size-6 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-white/5
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
						class="size-3.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 6.3C10.4 4.6 8 4 6.2 5.5 4.4 7 4.1 9.7 5.6 11.5L12 19l6.4-7.5c1.5-1.8 1.2-4.5-.6-6C16 4 13.6 4.6 12 6.3Z"
						/>
					</svg>
				</button>
				<button
					class="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-accent-600 dark:hover:bg-white/5"
					aria-label="Archive"
					title="Archive"
					onclick={() => recordingsStore.archive(recording.id)}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 4h16v4H4V4Zm1 4v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 13h4"
						/>
					</svg>
				</button>
				<button
					class="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/5"
					aria-label="Move to bin"
					title="Move to bin"
					onclick={() => recordingsStore.trash(recording.id)}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7"
						/>
					</svg>
				</button>
			</div>
			<p class="mb-2 text-xs text-gray-400">{formatTimestamp(recording.createdAt)}</p>
			<input
				class="mb-3 w-full bg-transparent text-sm text-gray-500 outline-none focus:underline dark:text-gray-400"
				placeholder="Add a description…"
				bind:value={recording.description}
				aria-label="Recording description"
			/>
			<audio controls src={recording.url} class="mb-3 w-full"></audio>

			<div class="relative flex flex-wrap items-center gap-1.5">
				<TagChips
					tags={tagsStore.list.filter((t) => recording.tagIds.includes(t.id))}
					selected={recording.tagIds}
					ontoggle={(tagId) => recordingsStore.toggleRecordingTag(recording.id, tagId)}
				/>
				<button
					class="rounded-full px-2.5 py-1 text-xs text-gray-400 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={() => (openTagPickerId = openTagPickerId === recording.id ? null : recording.id)}
				>
					+ tag
				</button>

				{#if openTagPickerId === recording.id}
					<button
						class="fixed inset-0 z-10 cursor-default"
						aria-label="Close tag picker"
						onclick={() => (openTagPickerId = null)}
					></button>
					<div class="card absolute top-full left-0 z-20 mt-1 w-56 p-3">
						<TagChips
							tags={tagsStore.list}
							selected={recording.tagIds}
							ontoggle={(tagId) => recordingsStore.toggleRecordingTag(recording.id, tagId)}
						/>
					</div>
				{/if}
			</div>
		</li>
	{:else}
		<li class="card border-dashed p-8 text-center text-sm text-gray-400">
			{recordingsStore.active.length > 0 ? 'No recordings match your search' : 'No recordings yet'}
		</li>
	{/each}
</ul>
