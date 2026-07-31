<script lang="ts">
	import type { Snippet } from 'svelte';
	import { vimZone } from '$lib/vimZone.svelte';
	import { onMount } from 'svelte';

	interface Props {
		onclose: () => void;
		children: Snippet;
		// Confirm/prompt popups (the common case) want the narrow default;
		// content-heavier panels (e.g. FilterPanel's date range + tags) can
		// widen it instead of the whole app reaching for a bespoke overlay.
		maxWidth?: string;
		// Opt-in: always centered (same position on every screen size, not just
		// desktop) with a dimming scrim behind it, for content substantial
		// enough to want that treatment, e.g. FilterPanel. Default keeps the
		// original lightweight bottom-anchored-on-mobile/centered-on-desktop
		// dialog with no scrim, used by quick confirm/prompt popups.
		centered?: boolean;
	}

	let { onclose, children, maxWidth = 'max-w-xs', centered = false }: Props = $props();

	// While vim mode is on, Escape is reserved exclusively for turning that
	// off (VimEscapeHandler.svelte), it must not also close whatever dialog
	// happens to be open in the same keystroke: one keystroke, one effect.
	// Off (or never touched), Escape closes this like normal.
	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape' && !vimZone.enabled) onclose();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	// Moves this overlay to a direct child of <body>, so its position:fixed
	// always resolves against the real viewport no matter where the dialog is
	// triggered from. Without this, any ancestor with a transform, filter, or
	// backdrop-filter silently becomes the containing block instead: this bit
	// twice already (the desktop search bar's centering `-translate-y-1/2`
	// transform, then the mobile floating search bar's `backdrop-blur-lg`),
	// each time breaking centering, stacking, and click-outside-to-close all
	// at once. A portal fixes the whole category at once rather than chasing
	// every future triggering ancestor one at a time.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}
</script>

<!-- Generic frosted-glass dialog shell. Default: no dark scrim (would fight
     the flat, no-decoration design language for something this lightweight),
     bottom-anchored on mobile so it's always in one-handed thumb reach
     regardless of where on screen the thing that opened it was, centered on
     desktop where that isn't a concern. `centered` opts into a proper
     centered-window treatment instead (same position everywhere, dimmed
     backdrop) for panels substantial enough to want that. Anything that
     needs a confirm/prompt popup should use this instead of building its own
     overlay, see TagRemoveConfirm.svelte for an example. -->
<div
	use:portal
	class="fixed z-50 flex justify-center px-4 {centered
		? 'inset-0 items-center'
		: 'inset-x-0 bottom-0 pb-[calc(1.5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] md:inset-0 md:items-center md:pb-4'}"
>
	<button
		class="fixed inset-0 cursor-default {centered ? 'bg-black/20' : ''}"
		aria-label="Close"
		onclick={onclose}
	></button>

	<div
		class="relative z-10 max-h-[85vh] w-full {maxWidth} overflow-y-auto rounded-2xl border border-gray-200/70 bg-white/70 p-5 text-center shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-black/60"
	>
		{@render children()}
	</div>
</div>
