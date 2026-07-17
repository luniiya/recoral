<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		onclose: () => void;
		children: Snippet;
	}

	let { onclose, children }: Props = $props();
</script>

<!-- Generic frosted-glass dialog shell: no dark scrim behind it (would fight
     the flat, no-decoration design language for something this lightweight),
     bottom-anchored on mobile so it's always in one-handed thumb reach
     regardless of where on screen the thing that opened it was, centered on
     desktop where that isn't a concern. Anything that needs a confirm/prompt
     popup should use this instead of building its own overlay, see
     TagRemoveConfirm.svelte for an example. -->
<div
	class="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1.5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] md:inset-0 md:items-center md:pb-4"
>
	<button class="fixed inset-0 cursor-default" aria-label="Close" onclick={onclose}></button>

	<div
		class="relative z-10 w-full max-w-xs rounded-2xl border border-gray-200/70 bg-white/70 p-5 text-center shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-black/60"
	>
		{@render children()}
	</div>
</div>
