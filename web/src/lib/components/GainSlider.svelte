<script lang="ts">
	interface Props {
		value: number; // 0-100
		oninput: (event: Event) => void;
		orientation?: 'horizontal' | 'vertical';
		class?: string;
	}

	let { value, oninput, orientation = 'horizontal', class: className = '' }: Props = $props();

	// Two-tone track (accent up to the current value, muted gray for the rest)
	// instead of one flat solid bar, matching the same "remaining" gray
	// (rgba(107,114,128,0.25)) the main seek bar in AudioPlayer.svelte already
	// uses for its own not-yet-reached zone. `to top` for vertical since
	// writing-mode reorients the element's own box to be tall/narrow, but
	// doesn't remap gradient directions along with it.
	let gradientDirection = $derived(orientation === 'vertical' ? 'to top' : 'to right');
	let trackBackground = $derived(
		`linear-gradient(${gradientDirection},
			var(--accent-500) 0%, var(--accent-500) ${value}%,
			rgba(107,114,128,0.25) ${value}%, rgba(107,114,128,0.25) 100%)`
	);
</script>

<input
	type="range"
	min="0"
	max="100"
	{value}
	{oninput}
	class="gain-slider {orientation === 'vertical' ? 'gain-slider-vertical' : ''} {className}"
	style:background={trackBackground}
	aria-label="Volume"
/>

<style>
	/* touch-action/user-select: none stops a fast drag that slips past the
	   thumb's small hit area from being read as a text-selection gesture over
	   whatever's nearby instead of a slider drag. */
	.gain-slider {
		appearance: none;
		height: 0.35rem;
		border-radius: 999px;
		touch-action: none;
		user-select: none;
	}

	.gain-slider-vertical {
		writing-mode: vertical-lr;
		direction: rtl;
		width: 0.35rem;
		height: 100%;
	}

	.gain-slider::-webkit-slider-thumb {
		appearance: none;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
	}

	.gain-slider::-moz-range-thumb {
		width: 0.85rem;
		height: 0.85rem;
		border: none;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
	}
</style>
