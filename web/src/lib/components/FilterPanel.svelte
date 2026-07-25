<script lang="ts">
	import { page } from '$app/state';
	import { filterPanelStore } from '$lib/filterPanel.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { subtagIds } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import Dialog from './Dialog.svelte';
	import TagChips from './TagChips.svelte';

	let dateActive = $derived(recordingsStore.dateFrom !== null || recordingsStore.dateTo !== null);
	let count = $derived(recordingsStore.selectedTagIds.length + (dateActive ? 1 : 0));

	// This panel lives inside the (main) layout's header, which never
	// unmounts across a client-side tab switch, so nothing else was closing
	// it: it used to stay open (and misplaced) after navigating away while
	// it was open.
	$effect(() => {
		page.url.pathname;
		filterPanelStore.set(false);
	});

	function setFrom(value: string) {
		recordingsStore.setDateRange(value || null, recordingsStore.dateTo);
	}

	function setTo(value: string) {
		recordingsStore.setDateRange(recordingsStore.dateFrom, value || null);
	}

	// Selecting a tag also selects all of its subtags (e.g. picking
	// "voiceacting" covers "voiceacting/certainvoice" too), not just the one
	// chip clicked.
	function toggleTagCascade(tagId: string) {
		const tag = tagsStore.list.find((t) => t.id === tagId);
		if (!tag) return;
		recordingsStore.toggleFilterTagGroup(subtagIds(tag, tagsStore.list));
	}
</script>

<div class="relative">
	<button
		class="relative flex size-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
		onclick={() => filterPanelStore.set(!filterPanelStore.open)}
		aria-label="Filter"
		title="Filter"
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

	{#if filterPanelStore.open}
		<Dialog onclose={() => filterPanelStore.set(false)} maxWidth="max-w-sm" centered>
			<div class="flex flex-col gap-5 text-left">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Filter</span>
					<div class="flex items-center gap-3">
						{#if count > 0}
							<button
								class="text-xs text-accent-600 hover:underline dark:text-accent-400"
								onclick={() => recordingsStore.clearFilters()}
							>
								Clear all
							</button>
						{/if}
						<button
							class="flex size-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
							aria-label="Close filter panel"
							onclick={() => filterPanelStore.set(false)}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
								<path stroke-linecap="round" d="M5 5l14 14M19 5 5 19" />
							</svg>
						</button>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<span class="form-label">Date range</span>
					<div class="flex items-center gap-2">
						<input
							type="date"
							class="form-input min-w-0 flex-1"
							value={recordingsStore.dateFrom ?? ''}
							max={recordingsStore.dateTo ?? undefined}
							onchange={(e) => setFrom(e.currentTarget.value)}
						/>
						<span class="shrink-0 text-xs text-gray-400">to</span>
						<input
							type="date"
							class="form-input min-w-0 flex-1"
							value={recordingsStore.dateTo ?? ''}
							min={recordingsStore.dateFrom ?? undefined}
							onchange={(e) => setTo(e.currentTarget.value)}
						/>
					</div>
				</div>

				<div class="flex min-h-0 flex-col gap-2">
					<span class="form-label">Tags</span>
					{#if tagsStore.list.length > 0}
						<!-- Capped and independently scrollable so a large tag list
							 doesn't push the header/close button or date range out of
							 reach; Dialog's own max-h-[85vh] is just a last-resort safety
							 net on top of this, not the primary fix. -->
						<div class="max-h-48 overflow-y-auto pr-1">
							<TagChips
								tags={tagsStore.list}
								allTags={tagsStore.list}
								selected={recordingsStore.selectedTagIds}
								ontoggle={toggleTagCascade}
							/>
						</div>
					{:else}
						<p class="text-xs text-gray-400">No tags yet</p>
					{/if}
				</div>
			</div>
		</Dialog>
	{/if}
</div>
