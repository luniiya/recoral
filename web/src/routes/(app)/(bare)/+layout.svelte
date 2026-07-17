<script lang="ts">
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import StatusBarSpacer from '$lib/components/StatusBarSpacer.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-white dark:bg-black">
	<StatusBarSpacer />
	<header class="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-6 dark:border-white/10">
		<a href="/" class="flex flex-1 items-center gap-2.5">
			<Logo size="size-7" />
			<span class="font-wordmark text-base font-semibold text-gray-900 dark:text-gray-100">recoral</span>
		</a>

		<div class="hidden items-center gap-3 md:flex">
			<ThemeToggle />
			<AvatarMenu />
		</div>
	</header>

	<main class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto w-full max-w-xl px-6 pt-10 pb-24 md:pb-10">
			{@render children()}
		</div>
	</main>
</div>

<BottomNav />
