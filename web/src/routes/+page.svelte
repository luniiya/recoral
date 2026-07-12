<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	$effect(() => {
		if (!auth.user) goto('/login');
	});

	type LocalRecording = {
		id: string;
		title: string;
		url: string;
		createdAt: Date;
		durationSeconds: number;
	};

	let recordings = $state<LocalRecording[]>([]);
	let isRecording = $state(false);
	let elapsedSeconds = $state(0);

	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let timerHandle: ReturnType<typeof setInterval> | null = null;
	let recordingStart = 0;

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

			recordings = [
				{
					id: crypto.randomUUID(),
					title: `Recording ${recordings.length + 1}`,
					url,
					createdAt: new Date(),
					durationSeconds
				},
				...recordings
			];

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

{#if auth.user}
	<div class="min-h-dvh bg-gray-50 dark:bg-neutral-950">
		<header class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10">
			<div class="flex items-center gap-2.5">
				<img src="/logo.png" alt="recoral" class="size-8 rounded-full object-cover" />
				<span class="font-semibold text-gray-900 dark:text-gray-100">recoral</span>
			</div>
			<div class="flex items-center gap-2">
				<ThemeToggle />
				<button
					class="rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
					onclick={() => auth.logout()}
				>
					Log out
				</button>
			</div>
		</header>

		<main class="mx-auto max-w-xl px-6 py-10">
			<div class="flex flex-col items-center gap-3 pb-10">
				<button
					class="flex size-16 items-center justify-center rounded-full text-white shadow-sm transition
						{isRecording ? 'bg-coral-700' : 'bg-coral-500 hover:bg-coral-600'}"
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
						<span class="size-1.5 animate-pulse rounded-full bg-coral-500"></span>
					{/if}
					<span class="tabular-nums">{isRecording ? formatDuration(elapsedSeconds) : 'Tap to record'}</span>
				</div>
			</div>

			<ul class="flex flex-col gap-3">
				{#each recordings as recording (recording.id)}
					<li class="card p-4">
						<div class="mb-2 flex items-baseline justify-between">
							<span class="text-sm font-medium text-gray-900 dark:text-gray-100">{recording.title}</span>
							<span class="text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
						</div>
						<p class="mb-2 text-xs text-gray-400">{formatTimestamp(recording.createdAt)}</p>
						<audio controls src={recording.url} class="w-full"></audio>
					</li>
				{:else}
					<li class="card border-dashed p-8 text-center text-sm text-gray-400">No recordings yet</li>
				{/each}
			</ul>
		</main>
	</div>
{/if}
