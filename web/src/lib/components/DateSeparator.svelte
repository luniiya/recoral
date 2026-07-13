<script lang="ts">
	let { level, label }: { level: 'month' | 'day'; label: string } = $props();
</script>

{#if level === 'month'}
	<p class="mt-6 mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{label}</p>
{:else}
	<p class="mt-4 mb-2 text-xs font-medium text-gray-400">{label}</p>
{/if}
