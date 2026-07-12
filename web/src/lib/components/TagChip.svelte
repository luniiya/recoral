<script lang="ts">
	import type { Tag } from '@recoral/shared';
	import { chipDot } from '$lib/tagColor';
	import { tagLeafLabel } from '$lib/tagPath';

	interface Props {
		tag: Tag;
		// Hue of the nearest parent tag, if this is a subtag. Renders the dot
		// as a hard-cut diagonal split (parent | own hue) and the border as a
		// left-to-right gradient between the two, instead of solid.
		parentHue?: number | null;
		label?: string;
		selected?: boolean;
		interactive?: boolean;
		// 'trash' for destructive removal (deleting the tag itself), 'cross'
		// for a lighter-weight action (detaching a tag from a recording).
		deleteIcon?: 'trash' | 'cross';
		onclick?: () => void;
		ondelete?: () => void;
	}

	let {
		tag,
		parentHue = null,
		label,
		selected = false,
		interactive = true,
		deleteIcon = 'trash',
		onclick,
		ondelete
	}: Props = $props();

	let displayLabel = $derived(label ?? tagLeafLabel(tag.name));

	let ringColor = $derived(
		parentHue !== null ? `linear-gradient(115deg, ${chipDot(parentHue)}, ${chipDot(tag.hue)})` : chipDot(tag.hue)
	);

	let dotBackground = $derived(
		parentHue !== null
			? `linear-gradient(115deg, ${chipDot(parentHue)} 50%, ${chipDot(tag.hue)} 50%)`
			: chipDot(tag.hue)
	);

	let fill = $derived(selected ? `color-mix(in oklch, ${chipDot(tag.hue)} 18%, transparent)` : 'transparent');
</script>

{#snippet dot()}
	<span class="relative inline-flex size-2.5 shrink-0 items-center justify-center">
		<span
			class="size-2.5 rounded-full transition-opacity {ondelete ? 'group-hover:opacity-0' : ''}"
			style:background={dotBackground}
		></span>
		{#if ondelete}
			<span
				role="button"
				tabindex="0"
				class="absolute inset-0 -m-1 flex items-center justify-center rounded-full text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 dark:text-gray-300"
				aria-label={deleteIcon === 'trash' ? `Move ${displayLabel} to bin` : `Remove ${displayLabel}`}
				onclick={(e) => {
					e.stopPropagation();
					ondelete?.();
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.stopPropagation();
						ondelete?.();
					}
				}}
			>
				{#if deleteIcon === 'trash'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-3">
						<path stroke-linecap="round" d="M5 5l14 14M19 5 5 19" />
					</svg>
				{/if}
			</span>
		{/if}
	</span>
{/snippet}

{#if interactive}
	<button
		type="button"
		class="tag-chip group relative flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-xs font-medium text-gray-700 transition dark:text-gray-200"
		style:--chip-ring={ringColor}
		style:--chip-ring-width={selected ? '2px' : '1.5px'}
		style:background-color={fill}
		{onclick}
	>
		{@render dot()}
		{displayLabel}
	</button>
{:else}
	<span
		class="tag-chip relative flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-xs font-medium text-gray-700 dark:text-gray-200"
		style:--chip-ring={ringColor}
	>
		{@render dot()}
		{displayLabel}
	</span>
{/if}

<style>
	/* Gradient/solid border with a genuinely transparent center: a real CSS
	   border can't take a gradient (and border-image ignores border-radius),
	   so this paints the ring on a ::before, sized down by `padding`, then
	   XORs out its own content-box to leave only the ring-width frame. */
	.tag-chip::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: var(--chip-ring-width, 1.5px);
		background: var(--chip-ring);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		pointer-events: none;
	}
</style>
