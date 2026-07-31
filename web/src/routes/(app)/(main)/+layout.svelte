<script lang="ts">
	import { page } from '$app/state';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import HeaderBrand from '$lib/components/HeaderBrand.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import StatusBarSpacer from '$lib/components/StatusBarSpacer.svelte';
	import TagChips from '$lib/components/TagChips.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import VimEscapeHandler from '$lib/components/VimEscapeHandler.svelte';
	import { detailPanelStore } from '$lib/detailPanel.svelte';
	import { liveRecordingStore } from '$lib/liveRecording.svelte';
	import { navIcons } from '$lib/navIcons';
	import { pageSelectStore } from '$lib/pageSelect.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { selectionStore } from '$lib/selection.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	// backdrop-filter is a real, measurable jank source on Android WebView
	// (GPU compositing recomputes the blur every frame something behind it
	// moves/scrolls), so it's dropped on native rather than fighting it.
	// Static per app run, not reactive, so computed once rather than called
	// inline in every class string below.
	const nativePlatform = isNativePlatform();
	let fileInput: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let dragDepth = 0;
	let selectionTagPickerOpen = $state(false);
	let confirmingBulkDelete = $state(false);
	let refreshing = $state(false);

	// Sidebar (224px) + the list rail a detail panel shrinks to (416px) leaves
	// a cramped detail view below this width, so it auto-collapses to
	// icon-only there instead, but only while a detail panel is actually
	// open (no reason to shrink it just because the window happens to be
	// this width otherwise). Desktop-only concern: on mobile the Sidebar
	// isn't shown at all (see Sidebar.svelte's own `hidden md:flex`).
	let windowWidth = $state(0);
	const SIDEBAR_COLLAPSE_WIDTH = 1100;
	let sidebarCollapsed = $derived(detailPanelStore.open && windowWidth > 0 && windowWidth < SIDEBAR_COLLAPSE_WIDTH);

	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await recordingsStore.load();
		} finally {
			refreshing = false;
		}
	}

	function bulkAddTag(tagId: string) {
		recordingsStore.addTagToMany(selectionStore.selectedIds, tagId);
		selectionTagPickerOpen = false;
		selectionStore.clear();
	}

	function bulkFavorite() {
		recordingsStore.favoriteMany(selectionStore.selectedIds);
		selectionStore.clear();
	}

	function bulkArchive() {
		recordingsStore.archiveMany(selectionStore.selectedIds);
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

	onMount(() => {
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Shift') selectionStore.setShiftHeld(true);
			else if (e.key === 'Escape' && selectionStore.active) selectionStore.clear();
		}
		function onKeyup(e: KeyboardEvent) {
			if (e.key === 'Shift') selectionStore.setShiftHeld(false);
		}
		// Losing focus (alt-tab, devtools, etc.) while physically still holding
		// shift would otherwise leave shiftHeld stuck true with no keyup to
		// clear it once focus returns.
		function onBlur() {
			selectionStore.setShiftHeld(false);
		}

		window.addEventListener('keydown', onKeydown);
		window.addEventListener('keyup', onKeyup);
		window.addEventListener('blur', onBlur);

		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('keyup', onKeyup);
			window.removeEventListener('blur', onBlur);
		};
	});
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-white dark:bg-black">
	<StatusBarSpacer />
	<header
		class="relative flex h-16 shrink-0 items-center gap-1 border-b border-gray-200 px-6 transition-colors dark:border-white/10
			{selectionStore.active ? 'bg-accent-50/70 dark:bg-accent-500/10' : ''}"
	>
		{#if selectionStore.active}
			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
				aria-label="Cancel selection"
				onclick={() => selectionStore.clear()}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
			<span class="flex-1 pl-1 text-sm font-medium text-gray-900 dark:text-gray-100">
				{selectionStore.count} selected
			</span>

			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
				aria-label="Favourite selected"
				title="Favourite selected"
				onclick={bulkFavorite}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d={navIcons.favourites.path} />
				</svg>
			</button>

			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
				aria-label="Archive selected"
				title="Archive selected"
				onclick={bulkArchive}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d={navIcons.archive.path} />
				</svg>
			</button>

			{#if tagsStore.list.length > 0}
				<div class="relative">
					<button
						class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
						aria-label="Add tag to selected"
						title="Add tag to selected"
						onclick={() => (selectionTagPickerOpen = !selectionTagPickerOpen)}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
							<path stroke-linecap="round" stroke-linejoin="round" d={navIcons.tags.path} />
						</svg>
					</button>
					{#if selectionTagPickerOpen}
						<button
							class="fixed inset-0 z-10 cursor-default"
							aria-label="Close tag picker"
							onclick={() => (selectionTagPickerOpen = false)}
						></button>
						<div class="card accent-scrollbar absolute top-full right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto p-3">
							<TagChips tags={tagsStore.list} allTags={tagsStore.list} selected={[]} ontoggle={bulkAddTag} />
						</div>
					{/if}
				</div>
			{/if}

			<button
				class="flex size-8 shrink-0 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
				aria-label="Delete selected"
				title="Delete selected"
				onclick={() => (confirmingBulkDelete = true)}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d={navIcons.bin.path} />
				</svg>
			</button>
		{:else}
			<HeaderBrand />

			<!-- Absolutely positioned (not a flex-1 middle child) so it centers on
				 the actual screen/header width, not just the leftover space between
				 the brand/select/import clusters, which shifts around as those
				 change width (e.g. Select appearing/disappearing per-route).
				 Centered via inset-0 + flex, deliberately not a top-1/2/
				 -translate-y-1/2 transform: a `transform` on an ancestor traps any
				 position:fixed descendant (FilterPanel's Dialog popover) into this
				 box as its containing block instead of the viewport, which is
				 exactly what broke that popover's centering, stacking, and
				 click-outside-to-close all at once. -->
			<div class="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
				<SearchBar class="pointer-events-auto w-full max-w-md bg-[#e5e7eb] dark:bg-white/5" />
			</div>

			<div class="ml-auto flex items-center gap-2">
				{#if page.url.pathname === '/' || page.url.pathname === '/favourites' || page.url.pathname === '/archive' || pageSelectStore.onStartSelecting}
					<button
						class="group hidden items-center overflow-hidden rounded-full px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 md:flex"
						onclick={() => (pageSelectStore.onStartSelecting ? pageSelectStore.onStartSelecting() : selectionStore.startSelecting())}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0">
							<circle cx="12" cy="12" r="9" />
							<path stroke-linecap="round" stroke-linejoin="round" d="m8 12.5 2.5 2.5L16 9.5" />
						</svg>
						<span
							class="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out whitespace-nowrap group-hover:ml-1.5 group-hover:max-w-[5rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[5rem] group-focus-visible:opacity-100"
						>
							Select
						</span>
					</button>
				{/if}

				<button
					class="group flex items-center overflow-hidden rounded-full px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
					onclick={() => fileInput?.click()}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
						/>
					</svg>
					<span
						class="ml-1.5 max-w-[5rem] overflow-hidden opacity-100 transition-all duration-300 ease-out whitespace-nowrap md:ml-0 md:max-w-0 md:opacity-0 md:group-hover:ml-1.5 md:group-hover:max-w-[5rem] md:group-hover:opacity-100 md:group-focus-visible:ml-1.5 md:group-focus-visible:max-w-[5rem] md:group-focus-visible:opacity-100"
					>
						Import
					</span>
				</button>

				<button
					class="group hidden items-center overflow-hidden rounded-full px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 md:flex"
					onclick={refresh}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						class="size-4 shrink-0 {refreshing ? 'animate-spin' : ''}"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 4v5h5M20 20v-5h-5M4.5 9a8 8 0 0 1 14.5-3M19.5 15a8 8 0 0 1-14.5 3"
						/>
					</svg>
					<span
						class="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-out whitespace-nowrap group-hover:ml-1.5 group-hover:max-w-[5rem] group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-[5rem] group-focus-visible:opacity-100"
					>
						Refresh
					</span>
				</button>
			</div>
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
		<Sidebar collapsed={sidebarCollapsed} />

		<main class="min-h-0 flex-1 overflow-hidden">
			{@render children()}
		</main>
	</div>
</div>

<svelte:window bind:innerWidth={windowWidth} />

{#if confirmingBulkDelete}
	<ConfirmDialog
		confirmLabel="Delete"
		danger
		onconfirm={confirmBulkDelete}
		onclose={() => (confirmingBulkDelete = false)}
	>
		{#snippet message()}
			Delete <span class="font-semibold">{selectionStore.count}</span>
			{selectionStore.count === 1 ? 'recording' : 'recordings'}?
		{/snippet}
	</ConfirmDialog>
{/if}

{#if page.url.pathname === '/' || page.url.pathname === '/favourites' || page.url.pathname === '/archive'}
	<div
		class="fixed inset-x-0 bottom-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] z-20 flex items-center gap-2 px-4 md:hidden"
	>
		<SearchBar
			class="min-w-0 flex-1 border border-gray-200/70 shadow-sm dark:border-white/10
				{nativePlatform
				? 'bg-white dark:bg-black'
				: 'bg-white/70 backdrop-blur-lg dark:bg-black/60'}"
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

<VimEscapeHandler />

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
