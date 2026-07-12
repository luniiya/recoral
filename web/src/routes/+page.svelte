<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';

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
<main>
	<header>
		<h1>recoral</h1>
		<button class="logout" onclick={() => auth.logout()}>Log out</button>
	</header>

	<div class="record-panel">
		<button
			class="record-button"
			class:recording={isRecording}
			onclick={toggleRecording}
			aria-label={isRecording ? 'Stop recording' : 'Start recording'}
		></button>
		<span class="timer">{isRecording ? formatDuration(elapsedSeconds) : 'Tap to record'}</span>
	</div>

	<ul class="recordings">
		{#each recordings as recording (recording.id)}
			<li>
				<div class="recording-meta">
					<span class="title">{recording.title}</span>
					<span class="duration">{formatDuration(recording.durationSeconds)}</span>
				</div>
				<audio controls src={recording.url}></audio>
			</li>
		{:else}
			<li class="empty">No recordings yet</li>
		{/each}
	</ul>
</main>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #fff8f5;
		color: #3a2e2a;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	main {
		max-width: 32rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		color: #ff7f5e;
		letter-spacing: 0.02em;
	}

	.logout {
		background: none;
		border: 1px solid #ffe1d6;
		border-radius: 0.5rem;
		padding: 0.4rem 0.75rem;
		color: #8a746c;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.record-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin: 2.5rem 0;
	}

	.record-button {
		width: 5rem;
		height: 5rem;
		border-radius: 50%;
		border: none;
		background: #ff7f5e;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(255, 127, 94, 0.35);
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}

	.record-button:hover {
		transform: scale(1.05);
	}

	.record-button.recording {
		background: #e8483a;
		border-radius: 1rem;
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 4px 16px rgba(232, 72, 58, 0.4);
		}
		50% {
			box-shadow: 0 4px 28px rgba(232, 72, 58, 0.7);
		}
	}

	.timer {
		font-variant-numeric: tabular-nums;
		color: #8a746c;
	}

	.recordings {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recordings li {
		background: #fff;
		border: 1px solid #ffe1d6;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
	}

	.recordings li.empty {
		text-align: center;
		color: #b8a49c;
		border-style: dashed;
	}

	.recording-meta {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}

	.duration {
		color: #b8a49c;
		font-variant-numeric: tabular-nums;
	}

	audio {
		width: 100%;
	}
</style>
