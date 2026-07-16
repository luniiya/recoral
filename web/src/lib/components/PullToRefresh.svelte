<script lang="ts">
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

	function onTouchStart(event: TouchEvent) {
		if (!scrollEl || scrollEl.scrollTop > 0 || refreshing) return;
		tracking = true;
		startY = event.touches[0].clientY;
	}

	function onTouchMove(event: TouchEvent) {
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
	<div
		class="pointer-events-none absolute top-0 right-0 left-0 z-20 flex justify-center overflow-hidden"
		style:height="{pullDistance}px"
		style:transition={refreshing ? 'height 0.2s ease' : undefined}
	>
		<div class="flex items-end pb-1.5">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				class="size-5 text-accent-500 {refreshing ? 'animate-spin' : ''}"
				style:transform={refreshing ? undefined : `rotate(${progress * 180}deg)`}
				style:opacity={refreshing ? 1 : progress}
			>
				<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-opacity="0.25" />
				<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
			</svg>
		</div>
	</div>
{/if}
