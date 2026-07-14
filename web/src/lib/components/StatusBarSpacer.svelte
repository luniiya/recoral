<script lang="ts">
	import { isNativePlatform } from '$lib/platform';
</script>

{#if isNativePlatform()}
	<div
		class="bg-white pt-[var(--android-status-top-inset,env(safe-area-inset-top))] dark:bg-black"
		aria-hidden="true"
	></div>
{/if}
