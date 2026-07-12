<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import SearchFilter from '$lib/components/SearchFilter.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let fileInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (!auth.loading && !auth.user) goto('/login');
	});

	onMount(() => {
		tagsStore.load();
	});

	function onFilesSelected(event: Event) {
		const files = (event.target as HTMLInputElement).files;
		if (files) recordingsStore.importFiles(files);
		(event.target as HTMLInputElement).value = '';
	}
</script>

{#if auth.user}
	<div class="flex min-h-dvh flex-col bg-gray-50 dark:bg-neutral-950">
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

		<div class="flex flex-1">
			<Sidebar />

			<main class="mx-auto w-full max-w-xl px-6 py-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
