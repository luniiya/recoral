<script lang="ts">
	import type { TimelineRow } from '$lib/dateGroups';
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface Props {
		timeline: TimelineRow[];
		scrollEl: HTMLElement | undefined;
		recordingRow: Snippet<[Extract<TimelineRow, { kind: 'recording' }>]>;
		separatorRow: Snippet<[Extract<TimelineRow, { kind: 'month' | 'day' }>]>;
	}

	let { timeline, scrollEl, recordingRow, separatorRow }: Props = $props();

	// Real rendering cost of ~1000 real RecordingCards mounted at once (not the
	// network fetch, that's just a few hundred KB of small metadata objects) is
	// what actually made the Recordings tab take ~1s to open. Windowing to only
	// the rows near the viewport (everything else replaced by two spacer divs
	// sized to make up the difference) fixes that without needing to touch the
	// server API or the active/archived/trashed/favorites split, which all
	// already share one in-memory list. Heights are estimates, not measured
	// (own trailing 12px baked in per row, replacing the old container's
	// gap-3, see the individual row wrapper divs below). Same "close enough,
	// cards are close to uniform height" tradeoff Scrubber.svelte already
	// makes for its own position math, not pixel-perfect but good enough that
	// drift is imperceptible.
	const RECORDING_HEIGHT = 90;
	const MONTH_HEIGHT = 64;
	const DAY_HEIGHT = 48;
	const OVERSCAN_PX = 800;

	function heightOf(row: TimelineRow) {
		if (row.kind === 'recording') return RECORDING_HEIGHT;
		return row.kind === 'month' ? MONTH_HEIGHT : DAY_HEIGHT;
	}

	let scrollTop = $state(0);
	let clientHeight = $state(0);

	$effect(() => {
		if (!scrollEl) return;
		const el = scrollEl;
		function sync() {
			scrollTop = el.scrollTop;
			clientHeight = el.clientHeight;
		}
		sync();
		el.addEventListener('scroll', sync, { passive: true });
		const resizeObserver = new ResizeObserver(sync);
		resizeObserver.observe(el);
		return () => {
			el.removeEventListener('scroll', sync);
			resizeObserver.disconnect();
		};
	});

	// Prefix sum of row heights, offsets[i] is where row i starts, the final
	// entry (one past the last row) is the total height.
	let offsets = $derived.by(() => {
		let acc = 0;
		const result: number[] = [0];
		for (const row of timeline) {
			acc += heightOf(row);
			result.push(acc);
		}
		return result;
	});

	let totalHeight = $derived(offsets.at(-1) ?? 0);

	let range = $derived.by(() => {
		const top = Math.max(0, scrollTop - OVERSCAN_PX);
		const bottom = scrollTop + clientHeight + OVERSCAN_PX;
		let start = 0;
		while (start < timeline.length && offsets[start + 1] < top) start++;
		let end = start;
		while (end < timeline.length && offsets[end] < bottom) end++;
		return { start, end };
	});

	let topSpacer = $derived(offsets[range.start] ?? 0);
	let bottomSpacer = $derived(Math.max(0, totalHeight - (offsets[range.end] ?? totalHeight)));

	// vimNav.svelte.ts's j/k cursor otherwise has no reason to keep the
	// scroll position in sync (it doesn't render anything itself), so a
	// cursor several rows past the current viewport just goes invisible with
	// no indication which way to keep pressing.
	//
	// Two-step, not just one scrollTo: the estimated row-height offsets above
	// are deliberately approximate (real cards vary a few px with tags/
	// wrapping descriptions), and `scrollTop` here only updates from the
	// DOM's own async 'scroll' event, so reading it back immediately after
	// calling scrollTo() raced that event and reused a stale value, which is
	// what made this drift or miss the target entirely under fast repeated
	// j/k. Fixed by (1) syncing `scrollTop` synchronously ourselves instead
	// of waiting on the event, so `range` recomputes in the same tick and the
	// row is guaranteed actually in the DOM, then (2) once it's there,
	// correcting against its real rendered position via scrollIntoView
	// instead of trusting the estimate for the final placement.
	//
	// Holding j/k fires keydown (and this) many times a second, faster than
	// one `await tick()` round-trip: without the requestId check below, an
	// older call's correction could still land *after* a newer keypress had
	// already jumped somewhere else, yanking the view back to a stale
	// position mid-hold. Only the most recent call's correction is allowed
	// to actually apply.
	let scrollRequestId = 0;
	export async function scrollToRecording(id: string) {
		if (!scrollEl) return;
		const index = timeline.findIndex((row) => row.kind === 'recording' && row.recording.id === id);
		if (index === -1) return;

		const requestId = ++scrollRequestId;

		const rowTop = offsets[index];
		const rowHeight = heightOf(timeline[index]);
		const estimatedTop = Math.max(0, rowTop - clientHeight / 2 + rowHeight / 2);
		scrollEl.scrollTop = estimatedTop;
		scrollTop = estimatedTop;

		await tick();
		if (requestId !== scrollRequestId) return;

		scrollEl.querySelector<HTMLElement>(`[data-recording-id="${CSS.escape(id)}"]`)?.scrollIntoView({
			block: 'center',
			behavior: 'auto'
		});
	}
</script>

<div style:height="{topSpacer}px"></div>
{#each timeline.slice(range.start, range.end) as row (row.key)}
	<div class="pb-3">
		{#if row.kind === 'recording'}
			{@render recordingRow(row)}
		{:else}
			{@render separatorRow(row)}
		{/if}
	</div>
{/each}
<div style:height="{bottomSpacer}px"></div>
