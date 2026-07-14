<script lang="ts">
	import { recordingsStore } from '$lib/recordings.svelte';
	import SearchFilter from './SearchFilter.svelte';

	let { class: className = '' }: { class?: string } = $props();
</script>

<div
	class="flex min-w-0 items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 transition focus-within:ring-2 focus-within:ring-accent-500 {className}"
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0 text-gray-400">
		<circle cx="11" cy="11" r="7" />
		<path stroke-linecap="round" d="m20 20-3.5-3.5" />
	</svg>
	<input
		class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
		type="search"
		placeholder="Search your recordings"
		value={recordingsStore.search}
		oninput={(e) => recordingsStore.setSearch(e.currentTarget.value)}
	/>
	<SearchFilter />
</div>
