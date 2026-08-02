<script lang="ts">
	import { shouldHandleVimKey } from '$lib/vimKeyGate';
	import { onMount } from 'svelte';

	// Headless, mirrors VimEscapeHandler.svelte: real vim's `/` to search,
	// only while already in vim mode (not one of NAV_KEYS, so it can't itself
	// turn vim mode on, matching how Space can't either, only a real nav key
	// can). Focuses whichever SearchBar.svelte input is actually visible,
	// there can be more than one mounted at once (desktop header vs. mobile's
	// floating one), picked by which one has real layout (offsetParent), vim
	// mode is desktop-only in spirit anyway so this only ever matters there.
	function focusVisibleSearchInput() {
		const inputs = document.querySelectorAll<HTMLInputElement>('input[type="search"]');
		for (const input of inputs) {
			if (input.offsetParent !== null) {
				input.focus();
				input.select();
				return;
			}
		}
	}

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.key !== '/') return;
			if (!shouldHandleVimKey(event)) return;
			event.preventDefault();
			focusVisibleSearchInput();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>
