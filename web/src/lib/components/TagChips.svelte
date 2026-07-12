<script lang="ts">
	import type { Tag } from '@recoral/shared';

	interface Props {
		tags: Tag[];
		selected: string[];
		ontoggle: (tagId: string) => void;
	}

	let { tags, selected, ontoggle }: Props = $props();
</script>

<div class="flex flex-wrap gap-1.5">
	{#each tags as tag (tag.id)}
		{@const active = selected.includes(tag.id)}
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-xs font-medium text-gray-700 transition dark:text-gray-200"
			class:ring-2={active}
			style:background-color={`oklch(94% 0.045 ${tag.hue})`}
			style:--tw-ring-color={`oklch(60% 0.17 ${tag.hue})`}
			onclick={() => ontoggle(tag.id)}
		>
			<span class="size-2 shrink-0 rounded-full" style:background-color={`oklch(60% 0.17 ${tag.hue})`}></span>
			{tag.name}
		</button>
	{:else}
		<span class="text-xs text-gray-400">No tags yet</span>
	{/each}
</div>
