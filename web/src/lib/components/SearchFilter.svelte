<script lang="ts">
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import TagChips from './TagChips.svelte';

	let open = $state(false);
	let count = $derived(recordingsStore.selectedTagIds.length);
</script>

<div class="relative">
	<button
		class="relative flex size-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
		onclick={() => (open = !open)}
		aria-label="Filter by tag"
		title="Filter by tag"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
			<path stroke-linecap="round" d="M4 6h16M8 12h8M11 18h2" />
		</svg>
		{#if count > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-semibold text-white"
			>
				{count}
			</span>
		{/if}
	</button>

	{#if open}
		<button class="fixed inset-0 z-10 cursor-default" aria-label="Close filters" onclick={() => (open = false)}
		></button>

		<div class="card absolute top-full right-0 z-20 mt-2 w-64 p-4">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Filter by tag</span>
				{#if count > 0}
					<button
						class="text-xs text-accent-600 hover:underline dark:text-accent-400"
						onclick={() => recordingsStore.clearFilters()}
					>
						Clear
					</button>
				{/if}
			</div>
			<TagChips
				tags={tagsStore.list}
				allTags={tagsStore.list}
				selected={recordingsStore.selectedTagIds}
				ontoggle={recordingsStore.toggleFilterTag}
			/>
		</div>
	{/if}
</div>
