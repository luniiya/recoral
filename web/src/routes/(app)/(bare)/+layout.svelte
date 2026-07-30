<script lang="ts">
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import HeaderBrand from '$lib/components/HeaderBrand.svelte';
	import StatusBarSpacer from '$lib/components/StatusBarSpacer.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-white dark:bg-black">
	<StatusBarSpacer />
	<header class="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-6 dark:border-white/10">
		<HeaderBrand class="flex flex-1 items-center gap-2.5" />

		<div class="hidden items-center gap-3 md:flex">
			<ThemeToggle />
			<AvatarMenu />
		</div>
	</header>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		{@render children()}
	</div>
</div>

<BottomNav />
