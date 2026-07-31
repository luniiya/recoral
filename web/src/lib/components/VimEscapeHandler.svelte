<script lang="ts">
	import { vimMode } from '$lib/vimMode.svelte';
	import { vimZone } from '$lib/vimZone.svelte';
	import { onMount } from 'svelte';

	// Headless: no markup, purely the Escape key. One-way only, same as vim's
	// own Escape always returning to Normal rather than itself entering a
	// mode: this only ever turns vimZone.enabled *off* (a no-op if it's
	// already off), never on, pressing a nav key again is what turns it back
	// on. Mounted once in the shared (main) shell regardless of which page or
	// Sidebar collapsed/expanded state is active, unlike ServerStatus's
	// NORMAL badge (only visible when the Sidebar itself is, i.e. not
	// collapsed, and only on desktop), so Escape keeps working everywhere
	// the feature does.
	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.key !== 'Escape' || vimMode.isTyping) return;
			vimZone.disable();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>
