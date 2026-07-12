<script lang="ts">
	import type { Tag } from '@recoral/shared';
	import { parentTag, tagBreadcrumb } from '$lib/tagPath';
	import TagChip from './TagChip.svelte';

	interface Props {
		tags: Tag[];
		allTags: Tag[];
		selected: string[];
		ontoggle: (tagId: string) => void;
	}

	let { tags, allTags, selected, ontoggle }: Props = $props();
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap gap-1.5">
		{#each tags as tag (tag.id)}
			<TagChip
				{tag}
				label={tagBreadcrumb(tag.name)}
				parentHue={parentTag(tag, allTags)?.hue ?? null}
				selected={selected.includes(tag.id)}
				deleteIcon="cross"
				onclick={() => ontoggle(tag.id)}
				ondelete={selected.includes(tag.id) ? () => ontoggle(tag.id) : undefined}
			/>
		{/each}
	</div>
{/if}
