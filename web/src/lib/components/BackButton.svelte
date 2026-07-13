<script lang="ts">
	let {
		href,
		onclick,
		label = 'Back'
	}: { href?: string; onclick?: () => void; label?: string } = $props();
</script>

{#if href}
	<a
		{href}
		class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
		aria-label={label}
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
		</svg>
	</a>
{:else}
	<button
		type="button"
		{onclick}
		class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
		aria-label={label}
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
		</svg>
	</button>
{/if}
