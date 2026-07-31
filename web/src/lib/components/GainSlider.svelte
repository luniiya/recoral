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
		transition: filter 0.15s ease;
	}

	.gain-slider-vertical {
		writing-mode: vertical-lr;
		direction: rtl;
		width: 0.35rem;
		height: 100%;
	}

	/* A bar, not a round dot: a dot here reads as a playback/seek thumb (see
	   AudioPlayer's own seek bar), which this isn't, it's a volume level. The
	   bar shape is oriented across the track (narrow the way the track runs,
	   long the other way) so it reads as a level indicator, same idea as
	   Scrubber.svelte's own bar-shaped position indicator. */
	.gain-slider::-webkit-slider-thumb {
		appearance: none;
		width: 0.3rem;
		height: 1.1rem;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.gain-slider::-moz-range-thumb {
		width: 0.3rem;
		height: 1.1rem;
		border: none;
		border-radius: 999px;
		background: var(--accent-500);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	/* Thumb width/height stay in physical (not writing-mode-relative) terms in
	   both Chromium and Firefox, unlike the track's own size, so the bar needs
	   its own explicit swap here to stay perpendicular to a vertical track. */
	.gain-slider-vertical::-webkit-slider-thumb {
		width: 1.1rem;
		height: 0.3rem;
	}

	.gain-slider-vertical::-moz-range-thumb {
		width: 1.1rem;
		height: 0.3rem;
	}

	/* Hover affordance so it reads as clickable/draggable, not just a static
	   level bar, e.g. the FloatingVolumeControl slider sitting on its own in
	   a corner of the Recordings/Favourites/Archive/Bin pages (as opposed to
	   inside the detail panel, where it's right next to obviously-interactive
	   transport buttons already). Thumb grows slightly and picks up a soft
	   accent glow; track itself brightens a touch too. */
	.gain-slider:hover::-webkit-slider-thumb {
		transform: scale(1.25);
		box-shadow: 0 0 0 6px color-mix(in oklch, var(--accent-500) 25%, transparent);
	}

	.gain-slider:hover::-moz-range-thumb {
		transform: scale(1.25);
		box-shadow: 0 0 0 6px color-mix(in oklch, var(--accent-500) 25%, transparent);
	}

	.gain-slider:hover {
		filter: brightness(1.08);
	}
</style>
