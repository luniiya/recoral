<script lang="ts">
	interface Props {
		src: string;
	}

	let { src }: Props = $props();

	let audioEl: HTMLAudioElement | undefined = $state();
	let playing = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let buffered = $state(0);
	let rate = $state(1);

	let playedPct = $derived(duration ? (currentTime / duration) * 100 : 0);
	let bufferedPct = $derived(duration ? (buffered / duration) * 100 : 0);

	// Played = accent, buffered-but-not-played = darker gray, not yet
	// downloaded = lighter gray, instead of one flat color for the whole bar.
	let seekBackground = $derived(
		`linear-gradient(to right,
			var(--accent-500) 0%, var(--accent-500) ${playedPct}%,
			rgba(107,114,128,0.55) ${playedPct}%, rgba(107,114,128,0.55) ${bufferedPct}%,
			rgba(107,114,128,0.25) ${bufferedPct}%, rgba(107,114,128,0.25) 100%)`
	);

	function updateBuffered() {
		if (!audioEl || audioEl.buffered.length === 0) return;
		buffered = audioEl.buffered.end(audioEl.buffered.length - 1);
	}

	// Volume slider: linear audio.volume feels dead for most of the slider's
	// travel then jumps hard near the top, because loudness perception is
	// roughly logarithmic, not linear (the classic "YouTube slider" mistake).
	// Map the 0-1 slider position through an exponential curve so each step
	// of the slider is an equal dB step instead, which is what actually
	// sounds "even" to the ear.
	const VOLUME_RANGE_DB = 50;
	let volumePosition = $state(1);
	let muted = $state(false);

	function sliderToGain(t: number) {
		if (t <= 0) return 0;
		return Math.pow(10, ((t - 1) * VOLUME_RANGE_DB) / 20);
	}

	let gain = $derived(muted ? 0 : sliderToGain(volumePosition));

	$effect(() => {
		if (audioEl) audioEl.volume = gain;
	});

	const RATES = [1, 1.5, 2];

	function formatTime(seconds: number) {
		if (!Number.isFinite(seconds)) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function togglePlay() {
		if (!audioEl) return;
		if (playing) audioEl.pause();
		else audioEl.play();
	}

	function skip(delta: number) {
		if (!audioEl) return;
		audioEl.currentTime = Math.max(0, Math.min(duration, audioEl.currentTime + delta));
	}

	function cycleRate() {
		const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
		rate = next;
		if (audioEl) audioEl.playbackRate = next;
	}

	function seek(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (audioEl) audioEl.currentTime = value;
		currentTime = value;
	}

	function onVolumeInput(event: Event) {
		volumePosition = Number((event.currentTarget as HTMLInputElement).value) / 100;
		if (volumePosition > 0) muted = false;
	}

	function toggleMute() {
		muted = !muted;
	}
</script>

<audio
	bind:this={audioEl}
	{src}
	preload="metadata"
	onplay={() => (playing = true)}
	onpause={() => (playing = false)}
	ontimeupdate={() => (currentTime = audioEl?.currentTime ?? 0)}
	onloadedmetadata={() => {
		duration = audioEl?.duration ?? 0;
		updateBuffered();
	}}
	ondurationchange={() => (duration = audioEl?.duration ?? 0)}
	onprogress={updateBuffered}
	class="hidden"
></audio>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-3">
		<span class="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">{formatTime(currentTime)}</span>
		<input
			type="range"
			min="0"
			max={duration || 0}
			step="0.01"
			value={currentTime}
			style:background={seekBackground}
			oninput={seek}
			class="seek-bar min-w-0 flex-1"
			aria-label="Seek"
		/>
		<span class="w-10 shrink-0 text-xs tabular-nums text-gray-400">
			-{formatTime(Math.max(0, duration - currentTime))}
		</span>
	</div>

	<div class="flex items-center gap-3">
		<div class="flex w-28 shrink-0">
			<button
				class="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-400 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={cycleRate}
			>
				{rate}×
			</button>
		</div>

		<div class="flex flex-1 items-center justify-center gap-5">
			<button
				class="flex size-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
				aria-label="Back 10 seconds"
				onclick={() => skip(-10)}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 12a8 8 0 1 1 2.5 5.8M4 12V7M4 12h5"
					/>
				</svg>
			</button>

			<button
				class="flex size-12 items-center justify-center rounded-full bg-accent-500 text-white transition hover:bg-accent-600"
				aria-label={playing ? 'Pause' : 'Play'}
				onclick={togglePlay}
			>
				{#if playing}
					<svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
						<path d="M8 5.5v13l11-6.5-11-6.5Z" />
					</svg>
				{/if}
			</button>

			<button
				class="flex size-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
				aria-label="Forward 10 seconds"
				onclick={() => skip(10)}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M20 12a8 8 0 1 0-2.5 5.8M20 12V7M20 12h-5"
					/>
				</svg>
			</button>
		</div>

		<div class="flex w-28 shrink-0 items-center justify-end gap-1.5">
			<input
				type="range"
				min="0"
				max="100"
				value={muted ? 0 : volumePosition * 100}
				oninput={onVolumeInput}
				class="seek-bar min-w-0 flex-1"
				aria-label="Volume"
			/>
			<button
				class="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
				aria-label={muted || gain === 0 ? 'Unmute' : 'Mute'}
				onclick={toggleMute}
			>
				{#if muted || gain === 0}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
						<path stroke-linecap="round" d="m16 9 5 6m0-6-5 6" />
					</svg>
				{:else if volumePosition < 0.5}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
						<path stroke-linecap="round" d="M16.5 9.5a5 5 0 0 1 0 5" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
						<path stroke-linecap="round" d="M16.5 9.5a5 5 0 0 1 0 5M19 7a9 9 0 0 1 0 10" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.seek-bar {
		appearance: none;
		height: 0.35rem;
		border-radius: 999px;
		background: var(--accent-500);
	}

	.seek-bar::-webkit-slider-thumb {
		appearance: none;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
	}

	.seek-bar::-moz-range-thumb {
		width: 0.85rem;
		height: 0.85rem;
		border: none;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
	}
</style>
