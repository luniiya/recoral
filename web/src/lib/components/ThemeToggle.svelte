<script lang="ts">
	import { themeStore } from '$lib/theme.svelte';

	const labels = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' } as const;
</script>

<button
	class="flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
	onclick={() => themeStore.cycle()}
	aria-label={`${labels[themeStore.preference]}, click to switch`}
	title={labels[themeStore.preference]}
>
	{#if themeStore.preference === 'system'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
			<rect x="3" y="4" width="18" height="13" rx="2" />
			<path d="M8 21h8M12 17v4" stroke-linecap="round" />
		</svg>
	{:else if themeStore.preference === 'light'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
			<circle cx="12" cy="12" r="4" />
			<path
				stroke-linecap="round"
				d="M12 3v1.5M12 19.5V21M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M3 12h1.5M19.5 12H21M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1"
			/>
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="currentColor" class="size-4">
			<path
				d="M20.7 14.6A8.5 8.5 0 1 1 9.4 3.3a1 1 0 0 1 1.2 1.3 6.5 6.5 0 0 0 8.8 8.8 1 1 0 0 1 1.3 1.2Z"
			/>
		</svg>
	{/if}
</button>
