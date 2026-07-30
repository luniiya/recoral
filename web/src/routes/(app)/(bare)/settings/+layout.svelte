<script lang="ts">
	import SettingsNav from '$lib/components/SettingsNav.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-0 flex-1 flex-col md:flex-row">
	<SettingsNav />
	<main class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto w-full max-w-xl px-6 pt-6 pb-24 md:pt-10 md:pb-10">
			{@render children()}
		</div>
	</main>
</div>
