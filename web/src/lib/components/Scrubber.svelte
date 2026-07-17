<script lang="ts">
	import type { ScrubberSegment } from '$lib/dateGroups';

	let { scrollEl, segments }: { scrollEl: HTMLElement | undefined; segments: ScrubberSegment[] } = $props();

	let trackEl: HTMLDivElement | undefined = $state();
	let trackHeight = $state(0);
	let scrollTop = $state(0);
	let scrollHeight = $state(0);
	let clientHeight = $state(0);
	let dragging = $state(false);
	let hovering = $state(false);
	let scrolling = $state(false);
	let hoverY = $state(0);
	let scrollingTimeout: ReturnType<typeof setTimeout> | null = null;
	// Bookkeeping only, not rendered: which segment the thumb was over last,
	// so crossing into a new one (while actually dragging/hovering it, not
	// during a passive scroll) can fire a haptic. Reset to null between drags
	// so landing on the first segment of a new drag never fires one.
	let lastHapticSegmentKey: string | null = null;

	const totalCount = $derived(segments.reduce((sum, s) => sum + s.count, 0));

	// Cumulative fraction of the track each segment starts at, sized by how
	// many recordings it holds relative to the whole list. Not a real pixel
	// mapping (the list isn't virtualized), just a good-enough approximation
	// since cards are close to uniform height.
	const positioned = $derived.by(() => {
		let cumulative = 0;
		return segments.map((segment) => {
			const startFraction = totalCount ? cumulative / totalCount : 0;
			cumulative += segment.count;
			return { ...segment, startFraction };
		});
	});

	const canScroll = $derived(scrollHeight > clientHeight + 1);
	const scrollFraction = $derived(canScroll ? scrollTop / (scrollHeight - clientHeight) : 0);

	function clamp01(n: number) {
		return Math.min(1, Math.max(0, n));
	}

	function segmentAtFraction(fraction: number) {
		let match = positioned[0];
		for (const segment of positioned) {
			if (segment.startFraction <= fraction) match = segment;
			else break;
		}
		return match;
	}

	const hoverSegment = $derived(segmentAtFraction(clamp01(hoverY / (trackHeight || 1))));
	const scrollSegment = $derived(segmentAtFraction(clamp01(scrollFraction)));
	const showLabels = $derived(dragging || hovering || scrolling);

	// Barely-there tick as the thumb crosses a month dot while actually being
	// dragged/hovered, a slightly bigger (but still subtle) one crossing into
	// a new year, both well under PullToRefresh.svelte's 10ms threshold tick.
	$effect(() => {
		if (!dragging && !hovering) {
			lastHapticSegmentKey = null;
			return;
		}
		const segment = hoverSegment;
		if (!segment) return;
		const key = `${segment.year}-${segment.month}`;
		if (key === lastHapticSegmentKey) return;
		const previousYear = lastHapticSegmentKey?.split('-')[0];
		if (lastHapticSegmentKey !== null) {
			navigator.vibrate?.(previousYear !== undefined && Number(previousYear) !== segment.year ? 5 : 2);
		}
		lastHapticSegmentKey = key;
	});
	const activeLabel = $derived.by(() => {
		if (dragging || hovering) return hoverSegment?.label;
		if (scrolling) return scrollSegment?.label;
		return undefined;
	});
	// Matches the thumb's own position formula below (top = scrollFraction *
	// (trackHeight - thumb height), plus half the thumb height to get its
	// center) so the label actually centers on the thumb instead of drifting
	// away from it as scrollFraction approaches 1.
	const labelY = $derived(
		dragging || hovering ? hoverY : scrollFraction * Math.max(trackHeight - 24, 0) + 12
	);

	function updateScrollFromClientY(clientY: number) {
		if (!trackEl || !scrollEl) return;
		const rect = trackEl.getBoundingClientRect();
		const fraction = clamp01((clientY - rect.top) / rect.height);
		scrollEl.scrollTop = fraction * (scrollEl.scrollHeight - scrollEl.clientHeight);
	}

	function setHoverY(clientY: number) {
		if (!trackEl) return;
		hoverY = clientY - trackEl.getBoundingClientRect().top;
	}

	function onPointerMove(event: PointerEvent) {
		setHoverY(event.clientY);
		updateScrollFromClientY(event.clientY);
	}

	function onPointerUp() {
		dragging = false;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
	}

	function onPointerDown(event: PointerEvent) {
		dragging = true;
		setHoverY(event.clientY);
		updateScrollFromClientY(event.clientY);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	}

	function syncFromScrollEl() {
		if (!scrollEl) return;
		scrollTop = scrollEl.scrollTop;
		scrollHeight = scrollEl.scrollHeight;
		clientHeight = scrollEl.clientHeight;
	}

	function onScroll() {
		syncFromScrollEl();
		scrolling = true;
		if (scrollingTimeout) clearTimeout(scrollingTimeout);
		scrollingTimeout = setTimeout(() => (scrolling = false), 500);
	}

	$effect(() => {
		if (!scrollEl) return;
		syncFromScrollEl();
		const el = scrollEl;
		el.addEventListener('scroll', onScroll, { passive: true });
		const resizeObserver = new ResizeObserver(syncFromScrollEl);
		resizeObserver.observe(el);
		return () => {
			el.removeEventListener('scroll', onScroll);
			resizeObserver.disconnect();
			if (scrollingTimeout) clearTimeout(scrollingTimeout);
		};
	});

	$effect(() => {
		if (!trackEl) return;
		const el = trackEl;
		const resizeObserver = new ResizeObserver(() => (trackHeight = el.clientHeight));
		resizeObserver.observe(el);
		trackHeight = el.clientHeight;
		return () => resizeObserver.disconnect();
	});
</script>

{#if canScroll}
	<div
		bind:this={trackEl}
		class="absolute top-0 right-0 bottom-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] z-10 w-5 cursor-row-resize touch-none select-none md:bottom-0"
		role="scrollbar"
		aria-orientation="vertical"
		aria-controls="scrubber-label"
		aria-valuenow={Math.round(scrollFraction * 100)}
		aria-valuemin={0}
		aria-valuemax={100}
		tabindex="0"
		onpointerdown={onPointerDown}
		onpointerenter={() => (hovering = true)}
		onpointerleave={() => (hovering = false)}
		onpointermove={(event) => setHoverY(event.clientY)}
	>
		{#each positioned as segment (segment.year + '-' + segment.month)}
			{#if segment.hasYearLabel}
				<span
					class="pointer-events-none absolute right-2.5 font-mono text-[10px] text-gray-400 transition-opacity {showLabels
						? 'opacity-100'
						: 'opacity-0'}"
					style:top="{segment.startFraction * trackHeight}px"
				>
					{segment.year}
				</span>
			{:else}
				<span
					class="pointer-events-none absolute right-2.5 size-1 rounded-full bg-gray-300 transition-opacity dark:bg-gray-600 {showLabels
						? 'opacity-100'
						: 'opacity-0'}"
					style:top="{segment.startFraction * trackHeight}px"
				></span>
			{/if}
		{/each}

		<div
			class="pointer-events-none absolute right-1 h-6 w-1 rounded-full bg-accent-500 transition-opacity {showLabels
				? 'opacity-100'
				: 'opacity-0'}"
			style:top="{scrollFraction * Math.max(trackHeight - 24, 0)}px"
		></div>

		{#if activeLabel}
			<div
				id="scrubber-label"
				class="pointer-events-none absolute right-7 -translate-y-1/2 rounded-lg border border-gray-200/70 bg-white/70 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-900 shadow-sm backdrop-blur-lg dark:border-white/10 dark:bg-black/60 dark:text-gray-100"
				style:top="{labelY}px"
			>
				{activeLabel}
			</div>
		{/if}
	</div>
{/if}
