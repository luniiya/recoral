<script lang="ts">
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<div class="min-h-dvh bg-gray-50 dark:bg-neutral-950">
	<header class="flex items-center gap-3 border-b border-gray-200 px-6 py-3 dark:border-white/10">
		<a
			href="/"
			class="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
			</svg>
			Back
		</a>

		<div class="flex flex-1 items-center gap-2.5">
			<img src="/logo.png" alt="recoral" class="size-6 rounded-full object-cover" />
			<span class="font-semibold text-gray-900 dark:text-gray-100">recoral</span>
		</div>

		<ThemeToggle />
		<AvatarMenu />
	</header>

	<main class="mx-auto w-full max-w-xl px-6 py-10">
		{@render children()}
	</main>
</div>
