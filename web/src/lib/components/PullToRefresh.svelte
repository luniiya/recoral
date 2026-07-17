<script lang="ts">
	import { selectionStore } from '$lib/selection.svelte';

	// Native-only (see isNativePlatform() gate at each call site): pull down
	// while already scrolled to the top of `scrollEl` to force a refresh from
	// the server, the standard mobile pattern. Real-time sync already pushes
	// updates automatically, but this is still the expected manual affordance
	// on mobile, and a useful fallback if the SSE connection ever dropped.
	let {
		scrollEl,
		onrefresh
	}: { scrollEl: HTMLElement | undefined; onrefresh: () => Promise<void> } = $props();

	const THRESHOLD = 64;
	const MAX_PULL = 90;

	let pulling = $state(false);
	let refreshing = $state(false);
	let pullDistance = $state(0);
	let startY = 0;
	let tracking = false;
	// Fires the vibration once per crossing into "release to refresh", not on
	// every touchmove tick while held past it, and resets on release so the
	// next pull can trigger it again.
	let hapticFired = false;

	function onTouchStart(event: TouchEvent) {
		// A card's own hold-to-select drag gesture (RecordingCard.svelte) needs
		// full control of touch movement once selection mode is active, this
		// would otherwise race it and win, since it's listening for the same
		// physical gesture independently on the scroll container.
		if (!scrollEl || scrollEl.scrollTop > 0 || refreshing || selectionStore.active) return;
		tracking = true;
		hapticFired = false;
		startY = event.touches[0].clientY;
	}

	function onTouchMove(event: TouchEvent) {
		if (selectionStore.active) {
			tracking = false;
			pulling = false;
			pullDistance = 0;
			return;
		}
		if (!tracking || !scrollEl) return;
		if (scrollEl.scrollTop > 0) {
			tracking = false;
			pulling = false;
			pullDistance = 0;
			return;
		}
		const delta = event.touches[0].clientY - startY;
		if (delta <= 0) {
			pulling = false;
			pullDistance = 0;
			return;
		}
		pulling = true;
		// Resisted drag (each pixel of finger movement adds less as you pull
		// further), the standard pull-to-refresh feel, not a 1:1 follow.
		pullDistance = Math.min(MAX_PULL, delta * 0.5);
		if (pullDistance >= THRESHOLD && !hapticFired) {
			hapticFired = true;
			navigator.vibrate?.(10);
		} else if (pullDistance < THRESHOLD) {
			hapticFired = false;
		}
		event.preventDefault();
	}

	async function onTouchEnd() {
		if (!tracking) return;
		tracking = false;
		if (pullDistance >= THRESHOLD && !refreshing) {
			refreshing = true;
			pullDistance = THRESHOLD;
			try {
				await onrefresh();
			} finally {
				refreshing = false;
				pulling = false;
				pullDistance = 0;
			}
		} else {
			pulling = false;
			pullDistance = 0;
		}
	}

	$effect(() => {
		if (!scrollEl) return;
		const el = scrollEl;
		el.addEventListener('touchstart', onTouchStart, { passive: true });
		el.addEventListener('touchmove', onTouchMove, { passive: false });
		el.addEventListener('touchend', onTouchEnd);
		return () => {
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('touchmove', onTouchMove);
			el.removeEventListener('touchend', onTouchEnd);
		};
	});

	let progress = $derived(Math.min(1, pullDistance / THRESHOLD));
</script>

{#if pulling || refreshing}
	<div class="pointer-events-none absolute top-0 right-0 left-0 z-20 h-[3px] overflow-hidden">
		{#if refreshing}
			<div class="loading-bar absolute inset-y-0 w-2/5 rounded-full bg-accent-500"></div>
		{:else}
			<!-- Grows from the center outward as you pull, not a fixed-origin
				 fill, so it reads as "building up toward release" rather than a
				 progress bar counting up from one edge. No transition on width
				 itself while actively dragging (must track the finger exactly),
				 only the opacity gets a tiny smoothing pass. -->
			<div
				class="absolute inset-y-0 left-1/2 rounded-full bg-accent-500 transition-opacity duration-100"
				style:width="{progress * 100}%"
				style:transform="translateX(-50%)"
				style:opacity={Math.max(0.35, progress)}
			></div>
		{/if}
	</div>
{/if}

<style>
	/* Classic Material indeterminate progress bar: a segment sliding fully
	   across, looping, rather than the pull-side bar's center-out growth. */
	.loading-bar {
		animation: loading-slide 1.1s ease-in-out infinite;
	}

	@keyframes loading-slide {
		0% {
			left: -40%;
		}
		100% {
			left: 100%;
		}
	}
</style>
