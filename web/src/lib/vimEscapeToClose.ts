import { vimZone } from './vimZone.svelte';
import { onMount } from 'svelte';

// Escape closes/cancels something (a Dialog, the recording detail panel),
// except while vim mode is on: Escape there is reserved exclusively for
// turning that off (VimEscapeHandler.svelte), it must not also close
// whatever's open in the same keystroke, one keystroke, one effect. Shared
// by Dialog.svelte and RecordingDetail.svelte instead of each
// re-implementing the same guard.
export function useEscapeToClose(onEscape: () => void, options: { skipWhileTyping?: boolean } = {}) {
	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.key !== 'Escape' || vimZone.enabled) return;
			if (options.skipWhileTyping && vimZone.isTyping) return;
			onEscape();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
}
