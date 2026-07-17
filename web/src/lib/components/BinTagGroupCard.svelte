<script lang="ts">
	import type { TrashedTagGroup } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import TagChip from './TagChip.svelte';

	interface Props {
		group: TrashedTagGroup;
		onrestore: () => void;
		ondelete: () => void;
		selectionActive: boolean;
		selected: boolean;
		onholdselect: () => void;
		onclickselect: (event: MouseEvent) => void;
	}

	let { group, onrestore, ondelete, selectionActive, selected, onholdselect, onclickselect }: Props = $props();

	const HOLD_MS = 550;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;

	function onPointerDown() {
		held = false;
		holdTimer = setTimeout(() => {
			held = true;
			holdTimer = null;
			navigator.vibrate?.(2);
			onholdselect();
		}, HOLD_MS);
	}

	function cancelHold() {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}

	function handleClick(event: MouseEvent) {
		if (held) {
			held = false;
			return;
		}
		if (selectionActive) onclickselect(event);
	}

	// The Restore/Delete buttons need to keep working normally even while
	// selection is active, rather than the wrapper's own hold/click-to-select
	// swallowing taps meant for them.
	function stop(event: Event) {
		event.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="relative -m-1 rounded-lg p-1 {selectionActive ? 'cursor-pointer' : ''}"
	role={selectionActive ? 'button' : undefined}
	tabindex={selectionActive ? 0 : undefined}
	onclick={handleClick}
	onpointerdown={onPointerDown}
	onpointerup={cancelHold}
	onpointerleave={cancelHold}
	onpointercancel={cancelHold}
>
	{#if selectionActive}
		<span
			class="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full border-2 transition-colors
				{selected ? 'border-accent-500 bg-accent-500 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-neutral-900'}"
		>
			{#if selected}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="size-3">
					<path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7" />
				</svg>
			{/if}
		</span>
	{/if}
	<div class="{selectionActive ? 'pl-7' : ''} flex flex-wrap items-center gap-1.5">
		<TagChip tag={group.root} interactive={false} />
		{#each group.descendants as descendant (descendant.id)}
			<TagChip tag={descendant} interactive={false} parentHue={group.root.hue} />
		{/each}
	</div>
	<p class="mt-1 text-xs text-gray-400 {selectionActive ? 'pl-7' : ''}">
		{tagsStore.daysLeft(group.root)} day{tagsStore.daysLeft(group.root) === 1 ? '' : 's'} left
	</p>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="mt-3 flex gap-2" onclick={stop} onpointerdown={stop}>
		<button
			class="flex-1 rounded-full bg-accent-500 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
			onclick={onrestore}
		>
			Restore
		</button>
		<button
			class="flex-1 rounded-full py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
			onclick={ondelete}
		>
			Delete forever
		</button>
	</div>
</div>
