<script lang="ts">
	import RecoralAccentLogo from './RecoralAccentLogo.svelte';
	import RecoralColoredLogo from './RecoralColoredLogo.svelte';

	interface Props {
		size?: string;
		textSize?: string;
		// See RecoralAccentLogo/RecoralColoredLogo for which to reach for.
		colored?: boolean;
	}

	let { size = 'size-7', textSize = 'text-base', colored = false }: Props = $props();
</script>

<div class="flex items-center gap-3 self-center">
	{#if colored}
		<RecoralColoredLogo {size} />
	{:else}
		<RecoralAccentLogo {size} />
	{/if}
	<span class="font-wordmark {textSize} font-semibold text-gray-900 dark:text-gray-100">recoral</span>
</div>
