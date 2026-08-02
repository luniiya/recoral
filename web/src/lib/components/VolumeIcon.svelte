<script lang="ts">
	interface Props {
		muted: boolean;
		gain: number;
		position: number;
		class?: string;
	}

	let { muted, gain, position, class: className = 'size-4.5' }: Props = $props();
</script>

{#if muted || gain === 0}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class={className}>
		<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
		<path stroke-linecap="round" d="m16 9 5 6m0-6-5 6" />
	</svg>
{:else if position < 0.5}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class={className}>
		<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
		<path stroke-linecap="round" d="M16.5 9.5a5 5 0 0 1 0 5" />
	</svg>
{:else}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class={className}>
		<path stroke-linecap="round" stroke-linejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
		<path stroke-linecap="round" d="M16.5 9.5a5 5 0 0 1 0 5M19 7a9 9 0 0 1 0 10" />
	</svg>
{/if}
