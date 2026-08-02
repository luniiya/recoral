<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		menu: Snippet<[() => void]>;
	}

	let { label = 'More options', menu }: Props = $props();

	let open = $state(false);
	function close() {
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
		aria-label={label}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
			<circle cx="12" cy="5" r="1.8" />
			<circle cx="12" cy="12" r="1.8" />
			<circle cx="12" cy="19" r="1.8" />
		</svg>
	</button>

	{#if open}
		<button class="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onclick={close}></button>
		<div class="card absolute top-full right-0 z-20 mt-1 w-48 overflow-hidden p-1.5">
			{@render menu(close)}
		</div>
	{/if}
</div>
