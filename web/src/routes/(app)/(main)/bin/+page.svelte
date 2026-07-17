<script lang="ts">
	import BinRecordingCard from '$lib/components/BinRecordingCard.svelte';
	import BinTagGroupCard from '$lib/components/BinTagGroupCard.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { pageSelectStore } from '$lib/pageSelect.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { rangeBetween } from '$lib/selection.svelte';
	import { groupTrashedTags, type TrashedTagGroup } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	type BinItem =
		| { kind: 'recording'; trashedAt: string; recording: (typeof recordingsStore.trashed)[number] }
		| { kind: 'tagGroup'; trashedAt: string; group: TrashedTagGroup };

	let items = $derived(
		[
			...recordingsStore.trashed.map(
				(recording) => ({ kind: 'recording', trashedAt: recording.trashedAt!, recording }) as BinItem
			),
			...groupTrashedTags(tagsStore.trashed).map(
				(group) => ({ kind: 'tagGroup', trashedAt: group.root.trashedAt!, group }) as BinItem
			)
		].sort((a, b) => b.trashedAt.localeCompare(a.trashedAt))
	);

	function keyOf(item: BinItem) {
		return item.kind === 'recording' ? `recording:${item.recording.id}` : `tagGroup:${item.group.root.id}`;
	}

	let orderedKeys = $derived(items.map(keyOf));

	// Bin-local, separate from the global multi-select in selection.svelte.ts:
	// this needs its own Restore/Delete-forever toolbar rather than the
	// shared header's +Tag/Delete one, which doesn't make sense for already-
	// trashed items or for the tag-group items that only exist here.
	let selectedKeys = $state<string[]>([]);
	let forcedActive = $state(false);
	let anchorKey = $state<string | null>(null);
	let active = $derived(forcedActive || selectedKeys.length > 0);

	function selectOnly(key: string) {
		selectedKeys = [key];
		anchorKey = key;
	}

	function toggle(key: string) {
		selectedKeys = selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key];
		anchorKey = key;
	}

	function onclickselect(key: string) {
		return (event: MouseEvent) => {
			if (event.shiftKey && anchorKey) {
				const merged = new Set(selectedKeys);
				for (const k of rangeBetween(orderedKeys, anchorKey, key)) merged.add(k);
				selectedKeys = [...merged];
				return;
			}
			toggle(key);
		};
	}

	function clearSelection() {
		selectedKeys = [];
		forcedActive = false;
		anchorKey = null;
	}

	function bulkRestore() {
		for (const item of items) {
			if (!selectedKeys.includes(keyOf(item))) continue;
			if (item.kind === 'recording') recordingsStore.restore(item.recording.id);
			else tagsStore.restore(item.group.root.id);
		}
		clearSelection();
	}

	function bulkDeleteForever() {
		for (const item of items) {
			if (!selectedKeys.includes(keyOf(item))) continue;
			if (item.kind === 'recording') recordingsStore.deleteForever(item.recording.id);
			else tagsStore.deleteForever(item.group.root.id);
		}
		confirmingBulkDelete = false;
		clearSelection();
	}

	let pendingDelete = $state<{ label: string; onconfirm: () => void } | null>(null);
	let confirmingBulkDelete = $state(false);

	onMount(() => {
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape' && active) clearSelection();
		}
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	$effect(() => {
		if (items.length > 0) pageSelectStore.register(() => (forcedActive = true));
		else pageSelectStore.clear();
		return () => pageSelectStore.clear();
	});
</script>

<svelte:head>
	<title>recoral - Bin</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 pt-10 pb-36 md:pb-10">
	{#if active}
		<div class="mb-6 flex items-center gap-3">
			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
				aria-label="Cancel selection"
				onclick={clearSelection}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
			<span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
				{selectedKeys.length} selected
			</span>
			<button
				class="rounded-full px-3.5 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={bulkRestore}
			>
				Restore
			</button>
			<button
				class="rounded-full px-3.5 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
				onclick={() => (confirmingBulkDelete = true)}
			>
				Delete
			</button>
		</div>
	{:else}
		<div class="mb-6">
			<h1 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Bin</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400">Items here are deleted for good after 30 days.</p>
		</div>
	{/if}

	<ul class="flex flex-col gap-3">
		{#each items as item (keyOf(item))}
			{@const key = keyOf(item)}
			<li class="card p-4">
				{#if item.kind === 'recording'}
					{@const recording = item.recording}
					<BinRecordingCard
						{recording}
						selectionActive={active}
						selected={selectedKeys.includes(key)}
						onholdselect={() => selectOnly(key)}
						onclickselect={onclickselect(key)}
						onrestore={() => recordingsStore.restore(recording.id)}
						ondelete={() =>
							(pendingDelete = {
								label: recording.title || 'this recording',
								onconfirm: () => recordingsStore.deleteForever(recording.id)
							})}
					/>
				{:else}
					{@const group = item.group}
					<BinTagGroupCard
						{group}
						selectionActive={active}
						selected={selectedKeys.includes(key)}
						onholdselect={() => selectOnly(key)}
						onclickselect={onclickselect(key)}
						onrestore={() => tagsStore.restore(group.root.id)}
						ondelete={() =>
							(pendingDelete = {
								label: group.root.name,
								onconfirm: () => tagsStore.deleteForever(group.root.id)
							})}
					/>
				{/if}
			</li>
		{:else}
			<li><EmptyState message="Bin is empty" /></li>
		{/each}
	</ul>
</div>

{#if pendingDelete}
	<Dialog onclose={() => (pendingDelete = null)}>
		<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
			Permanently delete <span class="font-semibold">{pendingDelete.label}</span>? This can't be undone.
		</p>
		<div class="flex gap-2">
			<button
				class="flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={() => (pendingDelete = null)}
			>
				Cancel
			</button>
			<button
				class="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
				onclick={() => {
					pendingDelete?.onconfirm();
					pendingDelete = null;
				}}
			>
				Delete
			</button>
		</div>
	</Dialog>
{/if}

{#if confirmingBulkDelete}
	<Dialog onclose={() => (confirmingBulkDelete = false)}>
		<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
			Permanently delete <span class="font-semibold">{selectedKeys.length}</span>
			{selectedKeys.length === 1 ? 'item' : 'items'}? This can't be undone.
		</p>
		<div class="flex gap-2">
			<button
				class="flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={() => (confirmingBulkDelete = false)}
			>
				Cancel
			</button>
			<button
				class="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
				onclick={bulkDeleteForever}
			>
				Delete
			</button>
		</div>
	</Dialog>
{/if}
