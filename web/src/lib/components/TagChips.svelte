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
			class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition"
			class:text-white={active}
			class:text-gray-600={!active}
			class:dark:text-gray-300={!active}
			style:background-color={active ? `oklch(60% 0.17 ${tag.hue})` : undefined}
			style:box-shadow={!active ? `inset 0 0 0 1px oklch(60% 0.17 ${tag.hue} / 0.5)` : undefined}
			onclick={() => ontoggle(tag.id)}
		>
			{tag.name}
		</button>
	{:else}
		<span class="text-xs text-gray-400">No tags yet</span>
	{/each}
</div>
