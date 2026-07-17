<script lang="ts">
	import { page } from '$app/state';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import HeaderBrand from '$lib/components/HeaderBrand.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import StatusBarSpacer from '$lib/components/StatusBarSpacer.svelte';
	import TagChips from '$lib/components/TagChips.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { liveRecordingStore } from '$lib/liveRecording.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { selectionStore } from '$lib/selection.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let fileInput: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let dragDepth = 0;
	let selectionTagPickerOpen = $state(false);
	let confirmingBulkDelete = $state(false);

	function bulkAddTag(tagId: string) {
		recordingsStore.addTagToMany(selectionStore.selectedIds, tagId);
		selectionTagPickerOpen = false;
		selectionStore.clear();
	}

	function confirmBulkDelete() {
		recordingsStore.trashMany(selectionStore.selectedIds);
		confirmingBulkDelete = false;
		selectionStore.clear();
	}

	function onFilesSelected(event: Event) {
		const files = (event.target as HTMLInputElement).files;
		if (files) recordingsStore.importFiles(files);
		(event.target as HTMLInputElement).value = '';
	}

	onMount(() => {
		function isFileDrag(e: DragEvent) {
			return Array.from(e.dataTransfer?.types ?? []).includes('Files');
		}

		function onDragEnter(e: DragEvent) {
			if (!isFileDrag(e)) return;
			dragDepth++;
			dragging = true;
		}

		function onDragOver(e: DragEvent) {
			if (isFileDrag(e)) e.preventDefault();
		}

		function onDragLeave() {
			dragDepth = Math.max(0, dragDepth - 1);
			if (dragDepth === 0) dragging = false;
		}

		function onDrop(e: DragEvent) {
			e.preventDefault();
			dragDepth = 0;
			dragging = false;
			if (e.dataTransfer?.files.length) recordingsStore.importFiles(e.dataTransfer.files);
		}

		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);

		return () => {
			window.removeEventListener('dragenter', onDragEnter);
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('dragleave', onDragLeave);
			window.removeEventListener('drop', onDrop);
		};
	});

	$effect(() => {
		if (!recordingsStore.importError) return;
		const timeout = setTimeout(() => recordingsStore.dismissImportError(), 4000);
		return () => clearTimeout(timeout);
	});
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-white dark:bg-black">
	<StatusBarSpacer />
	<header class="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-6 dark:border-white/10">
		{#if selectionStore.active}
			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
				aria-label="Cancel selection"
				onclick={() => selectionStore.clear()}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
			<span class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
				{selectionStore.count} selected
			</span>

			{#if tagsStore.list.length > 0}
				<div class="relative">
					<button
						class="rounded-full px-3.5 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
						onclick={() => (selectionTagPickerOpen = !selectionTagPickerOpen)}
					>
						+ Tag
					</button>
					{#if selectionTagPickerOpen}
						<button
							class="fixed inset-0 z-10 cursor-default"
							aria-label="Close tag picker"
							onclick={() => (selectionTagPickerOpen = false)}
						></button>
						<div class="card absolute top-full right-0 z-20 mt-1 w-56 p-3">
							<TagChips tags={tagsStore.list} allTags={tagsStore.list} selected={[]} ontoggle={bulkAddTag} />
						</div>
					{/if}
				</div>
			{/if}

			<button
				class="rounded-full px-3.5 py-1.5 text-sm font-medium text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
				onclick={() => (confirmingBulkDelete = true)}
			>
				Delete
			</button>
		{:else}
			<HeaderBrand />

			<div class="hidden flex-1 justify-center md:flex">
				<SearchBar class="w-full max-w-md bg-[#e5e7eb] dark:bg-white/5" />
			</div>

			<button
				class="ml-auto flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 md:ml-0"
				onclick={() => fileInput?.click()}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
					/>
				</svg>
				Import
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="audio/*"
				multiple
				class="hidden"
				onchange={onFilesSelected}
			/>

			<div class="hidden items-center gap-3 md:flex">
				<ThemeToggle />
				<AvatarMenu />
			</div>
		{/if}
	</header>

	<div class="flex min-h-0 flex-1">
		<Sidebar />

		<main class="min-h-0 flex-1 overflow-hidden">
			{@render children()}
		</main>
	</div>
</div>

{#if confirmingBulkDelete}
	<Dialog onclose={() => (confirmingBulkDelete = false)}>
		<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
			Delete <span class="font-semibold">{selectionStore.count}</span>
			{selectionStore.count === 1 ? 'recording' : 'recordings'}?
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
				onclick={confirmBulkDelete}
			>
				Delete
			</button>
		</div>
	</Dialog>
{/if}

{#if page.url.pathname === '/' || page.url.pathname === '/favourites' || page.url.pathname === '/archive'}
	<div
		class="fixed inset-x-0 bottom-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] z-20 flex items-center gap-2 px-4 md:hidden"
	>
		<SearchBar
			class="min-w-0 flex-1 border border-gray-200/70 bg-white/70 shadow-sm backdrop-blur-lg dark:border-white/10 dark:bg-black/60"
		/>
		{#if page.url.pathname === '/'}
			<button
				class="flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition
					{liveRecordingStore.isRecording ? 'bg-accent-700' : 'bg-accent-500 hover:bg-accent-600'}"
				onclick={() => liveRecordingStore.toggle()}
				aria-label={liveRecordingStore.isRecording ? 'Stop recording' : 'Start recording'}
			>
				{#if liveRecordingStore.isRecording}
					<span class="size-3.5 rounded-sm bg-white"></span>
				{:else}
					<span class="size-5 rounded-full bg-white"></span>
				{/if}
			</button>
		{/if}
	</div>
{/if}

<BottomNav />

{#if recordingsStore.importError}
	<div class="fixed top-4 left-1/2 z-50 -translate-x-1/2">
		<div class="flex items-center gap-2 rounded-full bg-red-600 py-2 pr-3 pl-4 text-sm text-white shadow-lg">
			<span>{recordingsStore.importError}</span>
			<button
				class="flex size-5 items-center justify-center rounded-full transition hover:bg-white/20"
				aria-label="Dismiss"
				onclick={() => recordingsStore.dismissImportError()}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-3">
					<path stroke-linecap="round" d="M5 5l14 14M19 5 5 19" />
				</svg>
			</button>
		</div>
	</div>
{/if}

{#if dragging}
	<div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/40 backdrop-blur-md dark:bg-black/25">
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.3"
			class="size-16 text-gray-900 dark:text-white"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
			/>
		</svg>
		<p class="text-3xl font-semibold text-gray-900 dark:text-white">Drop your file to import it</p>
	</div>
	<div class="drop-ring drop-ring-back pointer-events-none fixed inset-0 z-50"></div>
	<div class="drop-ring drop-ring-front pointer-events-none fixed inset-0 z-50"></div>
{/if}

<style>
	.drop-ring-back {
		color: var(--accent-700);
		opacity: 0.35;
		animation: drop-ring-pulse-back 3s ease-in-out infinite;
		animation-delay: -1.5s;
	}

	.drop-ring-front {
		color: var(--accent-500);
		opacity: 0.6;
		animation: drop-ring-pulse-front 3s ease-in-out infinite;
		animation-delay: -1.2s;
	}

	@keyframes drop-ring-pulse-back {
		0%,
		100% {
			box-shadow: inset 0 0 0 10px currentColor;
		}
		50% {
			box-shadow: inset 0 0 0 32px currentColor;
		}
	}

	@keyframes drop-ring-pulse-front {
		0%,
		100% {
			box-shadow: inset 0 0 0 0 currentColor;
		}
		50% {
			box-shadow: inset 0 0 0 12px currentColor;
		}
	}
</style>
