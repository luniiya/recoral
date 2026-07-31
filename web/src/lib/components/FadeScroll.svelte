<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		// Applied to the actual scrolling element (accent-scrollbar, text sizing, etc).
		class?: string;
		// The fade has to match whatever surface it's sitting on top of (a
		// gradient to white/black looks like a visible box when the real
		// surface behind it is tinted, e.g. RecordingDetail's bg-accent-50 /
		// dark:bg-accent-500/10 content panel), so it's caller-supplied rather
		// than hardcoded, same Tailwind from-*/dark:from-* class shape either way.
		fadeFrom?: string;
		children: Snippet;
	}

	let { class: scrollClass = '', fadeFrom = 'from-white dark:from-black', children }: Props = $props();

	let scrollEl = $state<HTMLElement>();
	let contentEl = $state<HTMLElement>();
	let showTop = $state(false);
	let showBottom = $state(false);

	// A few px of tolerance so a scroll position that's technically 1px off
	// "true" top/bottom (rounding, touch momentum scroll) doesn't flicker the
	// fade on/off right at the edge.
	const EDGE_TOLERANCE_PX = 4;

	function update() {
		if (!scrollEl) return;
		showTop = scrollEl.scrollTop > EDGE_TOLERANCE_PX;
		showBottom = scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - EDGE_TOLERANCE_PX;
	}

	onMount(() => {
		update();
		// Content growing/shrinking (e.g. a transcript arriving after the panel
		// is already open) changes scrollHeight without firing a 'scroll' event
		// and without resizing scrollEl's own border box, so a ResizeObserver on
		// scrollEl alone would miss it; watching the inner content wrapper
		// (which does grow/shrink with its content) catches that case too.
		const ro = new ResizeObserver(update);
		if (scrollEl) ro.observe(scrollEl);
		if (contentEl) ro.observe(contentEl);
		return () => ro.disconnect();
	});
</script>

<!-- Generic "long content that scrolls inside a fixed-height pane" wrapper:
     fades the top/bottom edge toward the surrounding background instead of
     text just being abruptly clipped by the scroll container, only shown
     on the edge that actually has more content past it (not a permanent
     decoration). Background-color-matched to whatever surface this sits on
     via the from-white/dark:from-black default, override with class if used
     somewhere with a different surface color. -->
<div class="relative flex min-h-0 flex-1 flex-col">
	{#if showTop}
		<div
			class="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b to-transparent {fadeFrom}"
		></div>
	{/if}
	<div bind:this={scrollEl} onscroll={update} class="min-h-0 flex-1 overflow-y-auto {scrollClass}">
		<div bind:this={contentEl}>
			{@render children()}
		</div>
	</div>
	{#if showBottom}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-linear-to-t to-transparent {fadeFrom}"
		></div>
	{/if}
</div>
