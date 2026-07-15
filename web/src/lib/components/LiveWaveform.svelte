<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		// Desktop/browser recording: a raw MediaStream analysed client-side.
		stream?: MediaStream | null;
		// Native recording: the mic is owned by the native plugin, not the
		// page, so there's no MediaStream to analyse here. The parent polls
		// the plugin's amplitude instead and passes each sample through this.
		amplitude?: number;
	}

	let { stream = null, amplitude = 0 }: Props = $props();

	const BAR_COUNT = 60;

	let levels = $state<number[]>(Array(BAR_COUNT).fill(0));

	$effect(() => {
		if (!stream) return;
		const audioCtx = new (window.AudioContext ??
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		const analyser = audioCtx.createAnalyser();
		analyser.fftSize = 256;
		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		const source = audioCtx.createMediaStreamSource(stream);
		source.connect(analyser);

		let frame = requestAnimationFrame(function tick() {
			analyser.getByteTimeDomainData(dataArray);
			let peak = 0;
			for (let i = 0; i < dataArray.length; i++) {
				const deviation = Math.abs(dataArray[i] - 128);
				if (deviation > peak) peak = deviation;
			}
			const level = Math.min(1, peak / 90);
			levels = [...levels.slice(1), level];
			frame = requestAnimationFrame(tick);
		});

		return () => {
			cancelAnimationFrame(frame);
			source.disconnect();
			audioCtx.close();
		};
	});

	$effect(() => {
		if (stream) return;
		// amplitude is the only thing this effect should re-run for; reading
		// levels directly here (to build the next window) makes the effect
		// depend on its own write, re-triggering itself every time it runs
		// (Svelte 5's effect_update_depth_exceeded infinite-loop trap).
		// untrack() reads the current value without registering it as a
		// dependency, keeping amplitude as the sole trigger.
		levels = [...untrack(() => levels).slice(1), amplitude];
	});
</script>

<div class="flex h-24 w-full items-center justify-center gap-0.5">
	{#each levels as level, i (i)}
		<span
			class="max-w-1.5 min-w-px flex-1 rounded-full bg-accent-500 transition-[height] duration-75"
			style:height="{Math.max(6, level * 100)}%"
		></span>
	{/each}
</div>
