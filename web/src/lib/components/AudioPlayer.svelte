<script module lang="ts">
	// A repeating sine wave, generated once and reused across instances. Both
	// the viewBox and the SVG's actual rendered size are set to the same
	// pixel values (no preserveAspectRatio scaling), so a stroke-width here
	// maps 1:1 to real pixels instead of getting squished by the track's
	// short height, that squish was what made the wave render far thinner
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
	import { getAccentColorHex } from '$lib/accent';
	import { AUDIO_FADE_MS, fadeInAndPlay, fadeOutAndPause } from '$lib/audioFade';
	import {
		clearMediaSession,
		setMediaSessionHandlers,
		setMediaSessionMetadata,
		setMediaSessionPlaybackState,
		setMediaSessionPositionState
	} from '$lib/mediaSession';
	import { isSupported as nativePlaybackSupported, Playback } from '$lib/nativePlayback';
	import { isNativePlatform } from '$lib/platform';
	import { sharedVolume } from '$lib/sharedVolume.svelte';
	import { sliderToGain } from '$lib/volume';
	import { wavySeekStore } from '$lib/wavySeek.svelte';
	import { onDestroy, untrack } from 'svelte';
	import GainSlider from './GainSlider.svelte';
	import VolumeIcon from './VolumeIcon.svelte';

	interface Props {
		src: string;
		title: string;
		currentTime?: number;
		playing?: boolean;
		audioEl?: HTMLAudioElement;
		// Bin cards show the recording's fixed total length instead of a
		// counting-down remaining time, more useful at a glance in a list you're
		// not actively scrubbing through.
		showTotalTime?: boolean;
		// Only passed where a favorite even applies (a real, synced recording);
		// on native, this replaces the volume slider spot since phones already
		// have hardware volume, leaving that side otherwise empty felt wasted.
		favorite?: boolean;
		onToggleFavorite?: () => void;
		// Pages showing many simultaneous inline players at once (Bin) hide the
		// per-card slider in favor of one shared floating control instead, see
		// FloatingVolumeControl.svelte; the volume level itself is always the
		// same shared value either way (sharedVolume.svelte.ts), this only
		// hides the redundant inline UI.
		hideVolumeControl?: boolean;
	}

	let {
		src,
		title,
		currentTime = $bindable(0),
		playing = $bindable(false),
		audioEl = $bindable(undefined),
		showTotalTime = false,
		favorite,
		onToggleFavorite,
		hideVolumeControl = false
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

	// `src` changing means a different recording was selected into this same
	// component instance (the parent doesn't remount it per recording), so
	// without this the elapsed time/seek position carried over from whatever
	// was previously loaded/playing.
	$effect(() => {
		src;
		currentTime = 0;
		smoothTime = 0;
		duration = 0;
		buffered = 0;
		playing = false;
	});

	// Registered once (not re-registered per play/pause) since the handlers
	// close over `audioEl`/`playing` via the functions below, which are
	// themselves reactive; only the OS-level media widget/notification needs
	// these at all (desktop media keys/widget, Android's media notification).
	setMediaSessionHandlers({
		play: () => audioEl && fadeInAndPlay(audioEl),
		pause: () => audioEl && fadeOutAndPause(audioEl),
		seekBackward: () => skip(-10),
		seekForward: () => skip(10)
	});

	$effect(() => {
		setMediaSessionMetadata(title);
	});

	$effect(() => {
		setMediaSessionPlaybackState(playing ? 'playing' : 'paused');
	});

	$effect(() => {
		setMediaSessionPositionState(duration, rate, smoothTime);
	});

	onDestroy(() => clearMediaSession());

	// The real Android media notification (see nativePlayback.ts for why this
	// exists alongside the Web Media Session calls above, which alone don't
	// surface anything on Android). Only starts the foreground service once
	// actual playback begins, not just because a recording is open/selected,
	// matching "show a media card when the media is playing".
	//
	// Must be $state, not a plain `let`: the update/interval effects below
	// read it in an early-return guard before ever reaching `playing`, so on
	// their first run (mount, before playback ever starts) they short-circuit
	// without establishing `playing` as a dependency at all. If this flag
	// isn't itself reactive, flipping it true from the start effect gives
	// them no reason to ever re-run. Confirmed via logs: Playback.update()
	// never fired again after the initial start(), the notification's
	// playing/position state was frozen from that first call forever after.
	let nativeSessionStarted = $state(false);
	let removeNativeListener: (() => void) | null = null;

	$effect(() => {
		if (!nativePlaybackSupported() || nativeSessionStarted || !playing) return;
		nativeSessionStarted = true;
		// untrack the position read here: this effect's only real dependency
		// is "has playback started", not the position itself, reading it
		// untracked avoids this effect (and the notification's initial post)
		// being reactive to every rAF-driven smoothTime tick.
		void Playback.start({
			title,
			playing: true,
			position: untrack(() => audioEl?.currentTime ?? smoothTime),
			duration,
			color: getAccentColorHex()
		});
		void Playback.addListener('playbackAction', (data) => {
			if (data.action === 'play') audioEl && fadeInAndPlay(audioEl);
			else if (data.action === 'pause') audioEl && fadeOutAndPause(audioEl);
			else if (data.action === 'seekBackward') skip(-10);
			else if (data.action === 'seekForward') skip(10);
			else if (data.action === 'seekTo' && data.position !== undefined) seekTo(data.position);
		}).then((handle) => {
			removeNativeListener = () => handle.remove();
		});
	});

	// Keeps play/pause, title, and duration correct the moment they actually
	// change. Reads audioEl.currentTime directly rather than smoothTime: this
	// effect runs before the effect further below that recalculates smoothTime
	// for the just-paused case (both depend on `playing`, and Svelte runs
	// effects in declaration order), so untracking smoothTime here was reading
	// a one-rAF-frame-stale value at the exact moment of pausing. Small in
	// isolation, but combined with speed dropping to 0 a beat late, this is
	// what made the notification's progress bar visibly creep past the real
	// paused position instead of freezing exactly there.
	$effect(() => {
		if (!nativePlaybackSupported() || !nativeSessionStarted) return;
		void Playback.update({
			title,
			playing,
			position: untrack(() => audioEl?.currentTime ?? smoothTime),
			duration,
			color: getAccentColorHex()
		});
	});

	// Position sync for the notification's own progress bar, throttled to
	// 1/sec instead of riding the rAF-driven smoothTime tick, which would
	// otherwise flood the native bridge and the NotificationManager ~60
	// times a second for no visible benefit.
	$effect(() => {
		if (!nativePlaybackSupported() || !nativeSessionStarted || !playing) return;
		const interval = setInterval(() => {
			void Playback.update({
				title,
				playing,
				position: audioEl?.currentTime ?? 0,
				duration,
				color: getAccentColorHex()
			});
		}, 1000);
		return () => clearInterval(interval);
	});

	onDestroy(() => {
		removeNativeListener?.();
		if (nativeSessionStarted) void Playback.stop();
	});

	// PlaybackService is a real foreground Service (see nativePlayback.ts):
	// once started it keeps running and showing its notification completely
	// independently of the Activity/WebView, onDestroy above only covers this
	// component actually unmounting (closing the detail panel), never the
	// whole app closing/backgrounding, which doesn't unmount anything. Without
	// this, closing the app left the notification behind forever, showing
	// play/pause controls with nothing left alive to actually act on them.
	// (clearMediaSession()/appStateChange in the root layout does NOT cover
	// this despite looking like it should: the plain Web Media Session API
	// never surfaces a notification on Android at all in a bare WebView, this
	// native service is the only thing actually showing one, confirmed via
	// dumpsys notification, see nativePlayback.ts.)
	$effect(() => {
		if (!nativePlaybackSupported()) return;
		let removeAppStateListener: (() => void) | undefined;
		let cancelled = false;
		import('@capacitor/app').then(({ App }) => {
			if (cancelled) return;
			App.addListener('appStateChange', ({ isActive }) => {
				if (isActive || !nativeSessionStarted) return;
				// Pausing (not just tearing down the native session) matters here:
				// `playing` staying true while nativeSessionStarted flips to false
				// is exactly the condition the start effect above (line ~153)
				// treats as "fresh start, go create the session", so leaving the
				// audio element itself playing made the notification resurrect
				// itself immediately after this very call tore it down, confirmed
				// via a real device log: stop() followed a couple seconds later by
				// another start() with playback still advancing, matching a real
				// report that only force-stopping the whole app actually got rid
				// of it. Pausing first makes that guard's `!playing` check true,
				// so the effect doesn't re-fire.
				if (audioEl) fadeOutAndPause(audioEl);
				nativeSessionStarted = false;
				void Playback.stop();
			}).then((handle) => {
				if (cancelled) handle.remove();
				else removeAppStateListener = () => handle.remove();
			});
		});
		return () => {
			cancelled = true;
			removeAppStateListener?.();
		};
	});

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

		const endFadeSec = AUDIO_FADE_MS / 1000;

		let frame = requestAnimationFrame(function tick() {
			smoothTime = audioEl!.currentTime;
			// Same declick reasoning as fadeOutAndPause/fadeInAndPlay (see
			// audioFade.ts), but for the one stop this component doesn't
			// initiate itself: the browser's own natural end-of-track. Ramping
			// down over the last ~30ms as playback approaches the real end
			// keeps that abrupt hardware-stream stop from producing a click.
			if (duration > 0) {
				const remaining = duration - smoothTime;
				audioEl!.volume = remaining < endFadeSec ? gain * Math.max(0, remaining / endFadeSec) : gain;
			}
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

	// Volume is a single shared value across every player instance, not a
	// separate memory per recording, see sharedVolume.svelte.ts. The
	// logarithmic taper (sliderToGain) is what makes equal slider steps feel
	// like equal loudness steps, instead of the classic "YouTube slider"
	// mistake of raw linear gain.
	let gain = $derived(sharedVolume.muted ? 0 : sliderToGain(sharedVolume.position));

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
		if (playing) fadeOutAndPause(audioEl);
		else fadeInAndPlay(audioEl);
	}

	function skip(delta: number) {
		if (!audioEl) return;
		seekTo(audioEl.currentTime + delta);
	}

	function cycleRate() {
		const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
		rate = next;
		if (audioEl) audioEl.playbackRate = next;
	}

	let trackEl: HTMLDivElement | undefined = $state();
	let dragging = $state(false);
	let volumePopoverOpen = $state(false);

	function seekTo(value: number) {
		const clamped = Math.max(0, Math.min(duration, value));
		if (audioEl) audioEl.currentTime = clamped;
		currentTime = clamped;
		// smoothTime otherwise only self-updates while playing (via the rAF
		// loop below); without this, seeking/skipping while paused silently
		// moves the real playback position but leaves the visible playhead
		// and elapsed time frozen on the old spot.
		smoothTime = clamped;
		// The native notification's own position push is either the
		// play/pause-transition effect or a while-playing interval, neither
		// of which fires from a seek that happens while paused, so it'd show
		// a stale position until the next play/pause toggle without this.
		if (nativePlaybackSupported() && nativeSessionStarted) {
			void Playback.update({ title, playing, position: clamped, duration, color: getAccentColorHex() });
		}
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
		sharedVolume.setPosition(Number((event.currentTarget as HTMLInputElement).value) / 100);
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
			{showTotalTime ? formatTime(duration) : `-${formatTime(Math.max(0, duration - currentTime))}`}
		</span>
	</div>

	<div class="flex items-center gap-1 md:gap-3">
		<div class="flex w-16 shrink-0 md:w-28">
			<button
				class="rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-400 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={cycleRate}
			>
				{rate}×
			</button>
		</div>

		<div class="flex flex-1 items-center justify-center gap-2 md:gap-5">
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

		<!-- Android/iOS manage system volume directly (hardware buttons,
			 the OS volume UI), an in-app slider would just be a second,
			 conflicting volume control, so that side shows the favorite
			 toggle instead on native rather than sitting empty. Pages with many
			 simultaneous inline players (Bin) pass hideVolumeControl instead,
			 relying on FloatingVolumeControl for that page; the reserved width
			 on this wrapper keeps the transport controls centered either way. -->
		<div class="flex w-16 shrink-0 items-center justify-end gap-1.5 md:w-28">
			{#if isNativePlatform()}
				{#if onToggleFavorite}
					<button
						class="flex size-8 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-white/5
							{favorite ? 'text-accent-500' : 'text-gray-400 hover:text-accent-500'}"
						aria-label={favorite ? 'Unfavourite' : 'Favourite'}
						onclick={onToggleFavorite}
					>
						<svg viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" class="size-4">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
							/>
						</svg>
					</button>
				{/if}
			{:else if !hideVolumeControl}
				<!-- An always-inline slider here has no room to shrink once the
					 detail panel itself gets narrow (list+detail split on a smaller
					 desktop window), and was overflowing off the edge of the panel
					 entirely rather than wrapping. A fixed-size button that reveals
					 the slider in a small popover instead can never overflow, since
					 the popover is positioned absolutely and doesn't take up row
					 space. Click-to-toggle (not hover): a hover popover here had a
					 gap between the button and the popup above it that broke hover
					 continuity the instant the mouse moved from one to the other,
					 making the slider disappear before it could ever be dragged. -->
				<div class="relative">
					<button
						class="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
						aria-label="Volume"
						onclick={() => (volumePopoverOpen = !volumePopoverOpen)}
					>
						<VolumeIcon muted={sharedVolume.muted} {gain} position={sharedVolume.position} />
					</button>

					{#if volumePopoverOpen}
						<button
							class="fixed inset-0 z-10 cursor-default"
							aria-label="Close volume"
							onclick={() => (volumePopoverOpen = false)}
						></button>
						<div
							class="absolute right-0 bottom-full z-20 mb-2 flex h-28 w-9 items-center justify-center rounded-full border border-gray-200/70 bg-white/90 p-2 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-black/70"
						>
							<GainSlider
								value={sharedVolume.muted ? 0 : sharedVolume.position * 100}
								oninput={onVolumeInput}
								orientation="vertical"
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
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
