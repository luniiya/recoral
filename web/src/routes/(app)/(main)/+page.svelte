<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LiveRecordingPanel from '$lib/components/LiveRecordingPanel.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import { buildTimeline } from '$lib/dateGroups';
	import { formatDuration } from '$lib/format';
	import { recordingsStore } from '$lib/recordings.svelte';

	let isRecording = $state(false);
	let elapsedSeconds = $state(0);
	let selectedId = $state<string | null>(null);
	let recordingStream = $state<MediaStream | null>(null);
	let savingRecording = $state(false);

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

	let selectedRecording = $derived(recordingsStore.active.find((r) => r.id === selectedId) ?? null);
	let timeline = $derived(buildTimeline(visibleRecordings));

	async function startRecording() {
		selectedId = null;
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		recordingStream = stream;
		chunks = [];
		mediaRecorder = new MediaRecorder(stream);

		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};

		mediaRecorder.onstop = async () => {
			const blob = new Blob(chunks, { type: mediaRecorder?.mimeType ?? 'audio/webm' });
			const durationSeconds = (Date.now() - recordingStart) / 1000;

			for (const track of stream.getTracks()) track.stop();
			recordingStream = null;
			savingRecording = true;

			const recording = await recordingsStore.addRecording(blob, '', durationSeconds);

			savingRecording = false;
			if (recording) selectedId = recording.id;
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

<div class="flex h-full">
	<div
		class="h-full overflow-y-auto transition-[width] duration-300 {selectedRecording ||
		isRecording ||
		savingRecording
			? 'w-[26rem] shrink-0'
			: 'w-full'}"
	>
		<div class="mx-auto max-w-xl px-6 py-10">
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
						<span class="size-6 rounded-full bg-white"></span>
					{/if}
				</button>
				<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
					{#if isRecording}
						<span class="size-1.5 animate-pulse rounded-full bg-accent-500"></span>
					{/if}
					<span class="tabular-nums">{isRecording ? formatDuration(elapsedSeconds) : 'Tap to record'}</span>
				</div>
			</div>

			<p class="mb-3 text-xs font-medium text-gray-400">
				{#if recordingsStore.search.trim() || recordingsStore.selectedTagIds.length > 0}
					{visibleRecordings.length} {visibleRecordings.length === 1 ? 'result' : 'results'}
				{:else}
					{recordingsStore.active.length} {recordingsStore.active.length === 1 ? 'recording' : 'recordings'}
				{/if}
			</p>

			<div class="flex flex-col gap-3">
				{#each timeline as row (row.key)}
					{#if row.kind === 'recording'}
						<RecordingCard
							recording={row.recording}
							selected={selectedId === row.recording.id}
							onselect={() => (selectedId = row.recording.id)}
						/>
					{:else}
						<DateSeparator level={row.kind} label={row.label} />
					{/if}
				{:else}
					<EmptyState
						message={recordingsStore.active.length > 0 ? 'No recordings match your search' : 'No recordings yet'}
					/>
				{/each}
			</div>
		</div>
	</div>

	{#if isRecording || savingRecording}
		<div class="min-w-0 flex-1 border-l border-gray-200 dark:border-white/10">
			<LiveRecordingPanel
				stream={recordingStream}
				{elapsedSeconds}
				saving={savingRecording}
				onStop={stopRecording}
			/>
		</div>
	{:else if selectedRecording}
		<div class="min-w-0 flex-1 border-l border-gray-200 dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
