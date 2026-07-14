<script lang="ts">
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import StatusBarSpacer from '$lib/components/StatusBarSpacer.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<div class="min-h-dvh bg-white dark:bg-black">
	<StatusBarSpacer />
	<header class="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-6 dark:border-white/10">
		<a href="/" class="flex flex-1 items-center gap-2.5">
			<img src="/logo.png" alt="recoral" class="size-7 rounded-full object-cover" />
			<span class="font-semibold text-gray-900 dark:text-gray-100">recoral</span>
		</a>

		<div class="hidden items-center gap-3 md:flex">
			<ThemeToggle />
			<AvatarMenu />
		</div>
	</header>

	<main class="mx-auto w-full max-w-xl px-6 pt-10 pb-24 md:pb-10">
		{@render children()}
	</main>
</div>

<BottomNav />
