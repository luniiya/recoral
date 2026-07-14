<script lang="ts">
	import { isNativePlatform } from '$lib/platform';
</script>

{#if isNativePlatform()}
	<div class="bg-white pt-[env(safe-area-inset-top)] dark:bg-black" aria-hidden="true"></div>
{/if}
