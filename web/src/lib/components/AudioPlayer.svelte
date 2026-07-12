<script module lang="ts">
	// A repeating sine wave, generated once and reused across instances. Both
	// the viewBox and the SVG's actual rendered size are set to the same
	// pixel values (no preserveAspectRatio scaling), so a stroke-width here
	// maps 1:1 to real pixels instead of getting squished by the track's
	// short height — that squish was what made the wave render far thinner
	// than the buffered/remaining bars it sits next to.
	const WAVE_WIDTH = 1200;
	// Taller than the track itself so the wave has real room to swing; its
	// container is centered over the thin track rather than clipped to it.
	const WAVE_HEIGHT = 24;
	const WAVE_LENGTH = 26;
	const WAVE_AMPLITUDE = 6;
	// Matches the track's original solid-bar thickness (0.35rem = 5.6px).
	const WAVE_STROKE_WIDTH = 5.6;

	function buildWavePath() {
		const samplesPerWave = 10;
		const step = WAVE_LENGTH / samplesPerWave;
		const midY = WAVE_HEIGHT / 2;
		const points: string[] = [];
		for (let x = 0; x <= WAVE_WIDTH; x += step) {
			const y = midY - WAVE_AMPLITUDE * Math.sin((2 * Math.PI * x) / WAVE_LENGTH);
			points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
		}
		return `M${points.join(' L')}`;
	}

	const WAVE_PATH = buildWavePath();
</script>

<script lang="ts">
	import { wavySeekStore } from '$lib/wavySeek.svelte';

	interface Props {
		src: string;
		currentTime?: number;
		playing?: boolean;
		audioEl?: HTMLAudioElement;
	}

	let {
		src,
		currentTime = $bindable(0),
		playing = $bindable(false),
		audioEl = $bindable(undefined)
	}: Props = $props();

	let waveActive = $derived(playing && wavySeekStore.enabled);

	let duration = $state(0);
	let buffered = $state(0);
	let rate = $state(1);

	// `currentTime` only updates on the sparse `timeupdate` event, so driving
	// the seek bar's width/thumb straight off it makes them visibly jump in
	// steps. While playing, read the element's real position every rAF frame
	// instead (see Waveform.svelte for the same fix, same reasoning).
	let smoothTime = $state(0);

	$effect(() => {
		if (!playing) {
			// Prefer the live element value over the prop even while paused:
			// `currentTime` only updates on `timeupdate`, so it can lag behind
			// where the rAF loop had already tracked to a moment ago, and
			// falling back to it on pause was itself causing a jump.
			smoothTime = audioEl ? audioEl.currentTime : currentTime;
			return;
		}
		if (!audioEl) return;

		let frame = requestAnimationFrame(function tick() {
			smoothTime = audioEl!.currentTime;
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	let playedPct = $derived(duration ? (smoothTime / duration) * 100 : 0);
	let bufferedPct = $derived(duration ? (buffered / duration) * 100 : 0);

	// Buffered-but-not-played = darker gray, not yet downloaded = lighter
	// gray; the played portion itself is drawn separately as a wavy/straight
	// line overlay (see below), not as part of this background.
	let seekTrackBackground = $derived(
		`linear-gradient(to right,
			rgba(107,114,128,0.55) 0%, rgba(107,114,128,0.55) ${bufferedPct}%,
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

	let trackEl: HTMLDivElement | undefined = $state();
	let dragging = $state(false);

	function seekTo(value: number) {
		const clamped = Math.max(0, Math.min(duration, value));
		if (audioEl) audioEl.currentTime = clamped;
		currentTime = clamped;
	}

	function seekToClientX(clientX: number) {
		if (!trackEl || !duration) return;
		const rect = trackEl.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		seekTo(pct * duration);
	}

	function onTrackPointerDown(event: PointerEvent) {
		dragging = true;
		trackEl?.setPointerCapture(event.pointerId);
		seekToClientX(event.clientX);
	}

	function onTrackPointerMove(event: PointerEvent) {
		if (dragging) seekToClientX(event.clientX);
	}

	function onTrackPointerUp() {
		dragging = false;
	}

	function onTrackKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') seekTo(currentTime + 5);
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') seekTo(currentTime - 5);
		else if (event.key === 'Home') seekTo(0);
		else if (event.key === 'End') seekTo(duration);
		else return;
		event.preventDefault();
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
		<div
			bind:this={trackEl}
			class="seek-track relative h-[0.35rem] min-w-0 flex-1 cursor-pointer touch-none rounded-full"
			style:background={seekTrackBackground}
			role="slider"
			tabindex="0"
			aria-label="Seek"
			aria-valuemin="0"
			aria-valuemax={duration || 0}
			aria-valuenow={currentTime}
			onpointerdown={onTrackPointerDown}
			onpointermove={onTrackPointerMove}
			onpointerup={onTrackPointerUp}
			onkeydown={onTrackKeydown}
		>
			<div
				class="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 overflow-hidden"
				style:width="{playedPct}%"
				style:height="{WAVE_HEIGHT}px"
			>
				<svg
					class="absolute top-0 left-0"
					style:width="{WAVE_WIDTH}px"
					style:height="{WAVE_HEIGHT}px"
					viewBox="0 0 {WAVE_WIDTH} {WAVE_HEIGHT}"
				>
					<line
						x1="0"
						y1={WAVE_HEIGHT / 2}
						x2={WAVE_WIDTH}
						y2={WAVE_HEIGHT / 2}
						stroke="var(--accent-500)"
						stroke-width={WAVE_STROKE_WIDTH}
						stroke-linecap="round"
						class="transition-opacity duration-200"
						style:opacity={waveActive ? 0 : 1}
					/>
					<path
						d={WAVE_PATH}
						fill="none"
						stroke="var(--accent-500)"
						stroke-width={WAVE_STROKE_WIDTH}
						stroke-linecap="round"
						class="wave-path transition-opacity duration-200"
						class:wave-active={waveActive}
						style:opacity={waveActive ? 1 : 0}
					/>
				</svg>
			</div>
			<div
				class="pointer-events-none absolute top-1/2 size-[0.85rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500"
				style:left="{playedPct}%"
			></div>
		</div>
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

	/* Shifting by exactly one wavelength (14px, matching WAVE_LENGTH) loops
	   seamlessly since the wave is periodic. Paused via animation-play-state
	   rather than removed, so it resumes mid-phase instead of resetting. */
	.wave-path {
		animation: wave-scroll 1.1s linear infinite;
		animation-play-state: paused;
	}

	.wave-path.wave-active {
		animation-play-state: running;
	}

	@keyframes wave-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-14px);
		}
	}
</style>
