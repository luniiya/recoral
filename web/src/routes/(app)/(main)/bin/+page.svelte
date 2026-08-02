<script lang="ts">
	import BinRecordingCard from '$lib/components/BinRecordingCard.svelte';
	import BinTagGroupCard from '$lib/components/BinTagGroupCard.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FloatingVolumeControl from '$lib/components/FloatingVolumeControl.svelte';
	import { api } from '$lib/api.svelte';
	import { pageSelectStore } from '$lib/pageSelect.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { rangeBetween } from '$lib/selection.svelte';
	import { groupTrashedTags, type TrashedTagGroup } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import { useVimScroll } from '$lib/vimScroll.svelte';
	import { onMount } from 'svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	useVimScroll({ scrollEl: () => scrollEl });

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

	// Recordings go through the batched job endpoints (bulkJob.svelte.ts,
	// same as the multi-select bulk actions elsewhere), tag groups stay as
	// individual calls for now, there's realistically never hundreds of
	// trashed tag groups at once the way there can be trashed recordings.
	function bulkRestore() {
		const recordingIds: string[] = [];
		for (const item of items) {
			if (!selectedKeys.includes(keyOf(item))) continue;
			if (item.kind === 'recording') recordingIds.push(item.recording.id);
			else tagsStore.restore(item.group.root.id);
		}
		recordingsStore.restoreMany(recordingIds);
		clearSelection();
	}

	function bulkDeleteForever() {
		const recordingIds: string[] = [];
		for (const item of items) {
			if (!selectedKeys.includes(keyOf(item))) continue;
			if (item.kind === 'recording') recordingIds.push(item.recording.id);
			else tagsStore.deleteForever(item.group.root.id);
		}
		recordingsStore.deleteManyForever(recordingIds);
		confirmingBulkDelete = false;
		clearSelection();
	}

	let pendingDelete = $state<{ label: string; onconfirm: () => void } | null>(null);
	let confirmingBulkDelete = $state(false);
	let confirmingEmptyBin = $state(false);

	// One request, server-side batch (server/src/recordings.ts's
	// emptyTrashedRecordings + tags.ts's emptyTrashedTags, both a single DB
	// transaction each), not the client looping deleteForever() once per
	// item like bulkDeleteForever above still does: a bin with hundreds of
	// items meant hundreds of individual DELETE requests hammering the
	// server one at a time, confirmed a real problem via a live capture.
	async function emptyBin() {
		await api.fetch('/api/bin', { method: 'DELETE', credentials: 'include' });
		confirmingEmptyBin = false;
		clearSelection();
		await Promise.all([recordingsStore.load(), tagsStore.load()]);
	}

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

<div bind:this={scrollEl} class="h-full overflow-y-auto">
	<div class="mx-auto max-w-xl px-6 pt-10 pb-36 md:pb-10">
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
			<div class="mb-6 flex items-start justify-between gap-3">
				<div>
					<h1 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Bin</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400">Items here are deleted for good after 30 days.</p>
				</div>
				{#if items.length > 0}
					<button
						class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
						onclick={() => (confirmingEmptyBin = true)}
					>
						Empty Bin
					</button>
				{/if}
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
</div>

{#if recordingsStore.trashed.length > 0}
	<FloatingVolumeControl />
{/if}

{#if pendingDelete}
	<ConfirmDialog
		confirmLabel="Delete"
		danger
		onconfirm={() => {
			pendingDelete?.onconfirm();
			pendingDelete = null;
		}}
		onclose={() => (pendingDelete = null)}
	>
		{#snippet message()}
			Permanently delete <span class="font-semibold">{pendingDelete?.label}</span>? This can't be undone.
		{/snippet}
	</ConfirmDialog>
{/if}

{#if confirmingBulkDelete}
	<ConfirmDialog confirmLabel="Delete" danger onconfirm={bulkDeleteForever} onclose={() => (confirmingBulkDelete = false)}>
		{#snippet message()}
			Permanently delete <span class="font-semibold">{selectedKeys.length}</span>
			{selectedKeys.length === 1 ? 'item' : 'items'}? This can't be undone.
		{/snippet}
	</ConfirmDialog>
{/if}

{#if confirmingEmptyBin}
	<ConfirmDialog confirmLabel="Empty Bin" danger onconfirm={emptyBin} onclose={() => (confirmingEmptyBin = false)}>
		{#snippet message()}
			Permanently delete all <span class="font-semibold">{items.length}</span>
			{items.length === 1 ? 'item' : 'items'} in the bin? This can't be undone.
		{/snippet}
	</ConfirmDialog>
{/if}
