<script lang="ts">
	interface Props {
		src: string;
		currentTime?: number;
		playing?: boolean;
		audioEl?: HTMLAudioElement;
	}

	let { src, currentTime = 0, playing = false, audioEl }: Props = $props();

	// Peaks are computed at a fixed time resolution (one bar per BAR_DURATION
	// seconds), independent of visual zoom, so zooming just rescales spacing
	// rather than requiring the audio to be re-analyzed.
	const BAR_DURATION = 0.1;
	const BASE_BAR_WIDTH = 3;
	const BASE_GAP = 2;
	const MIN_ZOOM = 0.5;
	const MAX_ZOOM = 4;

	let peaks = $state<number[]>([]);
	let loading = $state(true);
	let viewportWidth = $state(0);
	// A bit more zoomed in than 1x by default.
	let zoom = $state(1.6);

	async function loadWaveform(url: string) {
		loading = true;
		peaks = [];
		try {
			const res = await fetch(url, { credentials: 'include' });
			const arrayBuffer = await res.arrayBuffer();
			const AudioContextCtor =
				window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			const audioCtx = new AudioContextCtor();
			const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
			const channelData = audioBuffer.getChannelData(0);
			const samplesPerBar = Math.max(1, Math.floor(BAR_DURATION * audioBuffer.sampleRate));
			const barCount = Math.max(1, Math.ceil(channelData.length / samplesPerBar));

			const raw: number[] = [];
			for (let i = 0; i < barCount; i++) {
				const start = i * samplesPerBar;
				let peak = 0;
				for (let j = start; j < start + samplesPerBar && j < channelData.length; j++) {
					const abs = Math.abs(channelData[j]);
					if (abs > peak) peak = abs;
				}
				raw.push(peak);
			}

			const max = Math.max(...raw, 0.0001);
			peaks = raw.map((p) => p / max);
			await audioCtx.close();
		} catch {
			peaks = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadWaveform(src);
	});

	// `timeupdate` only fires a handful of times a second and irregularly, so
	// driving the scroll straight off `currentTime` looks jerky. While
	// playing, read the media element's real currentTime every rAF frame
	// instead — that's ground truth updated live by the browser (including
	// during a seek), so there's no extrapolation to drift or jump. While
	// paused, prefer the live element value too: `currentTime` only updates
	// on `timeupdate`, so it can lag behind where the rAF loop had already
	// tracked to a moment ago, and falling back to it on pause/resume was
	// itself causing a visible jump.
	let smoothTime = $state(0);

	$effect(() => {
		// Read (not use) `currentTime` so this effect actually re-runs when a
		// seek happens while paused. `audioEl`/`playing` alone don't change on
		// a seek, so without this the effect never re-fires and the waveform
		// stays frozen on the pre-seek position even though the real audio
		// element (shared with AudioPlayer) did move. Still assigning from
		// the live element value below, not straight from the prop, since
		// `currentTime` only updates via the sparse `timeupdate` event and
		// can lag a moment behind where the rAF loop had already tracked to.
		void currentTime;

		if (!playing) {
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

	let barWidth = $derived(BASE_BAR_WIDTH * zoom);
	let gap = $derived(BASE_GAP * zoom);
	let pitch = $derived(barWidth + gap);
	let playheadPx = $derived(viewportWidth / 2);
	let offsetPx = $derived(playheadPx - (smoothTime / BAR_DURATION) * pitch);

	function zoomIn() {
		zoom = Math.min(MAX_ZOOM, zoom * 1.25);
	}

	function zoomOut() {
		zoom = Math.max(MIN_ZOOM, zoom / 1.25);
	}
</script>

{#snippet barsRow(colorClass: string)}
	<div class="flex h-full items-center" style:gap="{gap}px" style:transform="translateX({offsetPx}px)">
		{#each peaks as amplitude, i (i)}
			<span
				class="shrink-0 rounded-full {colorClass}"
				style:width="{barWidth}px"
				style:height="{Math.max(4, amplitude * 100)}%"
			></span>
		{/each}
	</div>
{/snippet}

<div class="relative flex h-full w-full items-center justify-center">
	<div class="relative h-24 w-full overflow-hidden" bind:clientWidth={viewportWidth}>
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="size-1.5 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600"></div>
			</div>
		{:else if peaks.length === 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.3"
					class="size-16 text-gray-300 dark:text-gray-600"
				>
					<path stroke-linecap="round" d="M4 12h2l2-6 3 14 2-10 2 6h5" />
				</svg>
			</div>
		{:else}
			<!-- Everything behind the playhead is masked to a fixed-width accent
			     overlay instead of coloring bars by data index, so the played/
			     unplayed boundary always lines up exactly with the playhead, even
			     mid-transition. -->
			<div class="absolute inset-0 top-0">
				{@render barsRow('bg-gray-300 dark:bg-gray-600')}
			</div>
			<div class="absolute inset-y-0 left-0 overflow-hidden" style:width="{playheadPx}px">
				{@render barsRow('bg-accent-500')}
			</div>

			<div
				class="pointer-events-none absolute inset-y-0 w-px bg-gray-400 dark:bg-white/30"
				style:left="{playheadPx}px"
			></div>
		{/if}
	</div>

	{#if !loading && peaks.length > 0}
		<div class="absolute top-0 right-0 flex items-center gap-1">
			<button
				class="flex size-6 items-center justify-center rounded-full bg-black/5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
				aria-label="Zoom out"
				onclick={zoomOut}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
					<path stroke-linecap="round" d="M5 12h14" />
				</svg>
			</button>
			<button
				class="flex size-6 items-center justify-center rounded-full bg-black/5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
				aria-label="Zoom in"
				onclick={zoomIn}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
					<path stroke-linecap="round" d="M12 5v14M5 12h14" />
				</svg>
			</button>
		</div>
	{/if}
</div>
