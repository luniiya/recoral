<script lang="ts">
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import SearchFilter from '$lib/components/SearchFilter.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let fileInput: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let dragDepth = 0;

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
	<header class="flex items-center gap-3 border-b border-gray-200 px-6 py-3 dark:border-white/10">
		<a href="/" class="flex items-center gap-2.5">
			<img src="/logo.png" alt="recoral" class="size-7 rounded-full object-cover" />
			<span class="font-semibold text-gray-900 dark:text-gray-100">recoral</span>
		</a>

		<div class="flex flex-1 justify-center">
			<div
				class="flex w-full max-w-md items-center gap-2 rounded-full bg-[#e5e7eb] py-1.5 pr-1.5 pl-3.5 transition focus-within:ring-2 focus-within:ring-accent-500 dark:bg-white/5"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="size-4 shrink-0 text-gray-400"
				>
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
		</div>

		<button
			class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
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

		<ThemeToggle />
		<AvatarMenu />
	</header>

	<div class="flex min-h-0 flex-1">
		<Sidebar />

		<main class="mx-auto w-full max-w-xl overflow-y-auto px-6 py-10">
			{@render children()}
		</main>
	</div>
</div>

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
