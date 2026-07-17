// Multi-select mode for the recordings list (Recordings/Favourites/Archive
// all share RecordingCard, so this one store covers all three, and the
// bulk-action toolbar lives in (main)/+layout.svelte's header since that's
// shared across those pages too). Not gated to native, this is desktop and
// mobile web as much as the app.
let selectedIds = $state<string[]>([]);
// Set by the desktop "Select" button in the header (no hold-to-select gesture
// there), turns on the selection UI (checkboxes, toolbar) with nothing picked
// yet rather than requiring a first item to seed it like enter() does.
let forcedActive = $state(false);
// The last item explicitly clicked/entered-on, shift+click extends the
// selection from here rather than from wherever the pointer last was.
let anchorId = $state<string | null>(null);
// Tracked globally (see (main)/+layout.svelte's keydown/keyup listeners) so
// RecordingCard can preview the shift-click range on hover, before the click
// that actually commits it.
let shiftHeld = $state(false);
let hoveredId = $state<string | null>(null);

function isSelected(id: string) {
	return selectedIds.includes(id);
}

function enter(id: string) {
	selectedIds = [id];
	anchorId = id;
}

function toggle(id: string) {
	selectedIds = isSelected(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
	anchorId = id;
}

// Always adds, never removes, for the touch drag-select gesture (hold one
// card, drag across others without lifting): re-crossing an already-selected
// card while still dragging shouldn't deselect it, unlike a plain toggle.
function add(id: string) {
	if (!isSelected(id)) selectedIds = [...selectedIds, id];
}

// Range is computed by the caller (RecordingCard, via rangeBetween below,
// since only the page/card knows the current visible order), this just
// merges it in. Doesn't move the anchor, so a second shift+click further
// down extends from the same original anchor, standard file-manager style.
function selectRange(ids: string[]) {
	const merged = new Set(selectedIds);
	for (const id of ids) merged.add(id);
	selectedIds = [...merged];
}

// Replaces the whole selection outright (deduped), for the touch drag-select
// gesture: each move recomputes baseline-selection ∪ current-drag-range and
// calls this with it, so dragging back up past cards the drag itself added
// actually drops them again, instead of selectRange's merge-only semantics
// which can never shrink a selection once a card's been swept over once.
function setSelection(ids: string[]) {
	selectedIds = [...new Set(ids)];
}

function startSelecting() {
	forcedActive = true;
}

function setShiftHeld(value: boolean) {
	shiftHeld = value;
}

function setHovered(id: string | null) {
	hoveredId = id;
}

function clear() {
	selectedIds = [];
	forcedActive = false;
	anchorId = null;
	hoveredId = null;
}

// Inclusive slice between two ids in a given order, regardless of which one
// comes first. Either id missing from the order just means no preview/range.
export function rangeBetween(orderedIds: string[], fromId: string, toId: string): string[] {
	const fromIndex = orderedIds.indexOf(fromId);
	const toIndex = orderedIds.indexOf(toId);
	if (fromIndex === -1 || toIndex === -1) return [];
	const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
	return orderedIds.slice(start, end + 1);
}

export const selectionStore = {
	get selectedIds() {
		return selectedIds;
	},
	get active() {
		return forcedActive || selectedIds.length > 0;
	},
	get count() {
		return selectedIds.length;
	},
	get anchorId() {
		return anchorId;
	},
	get shiftHeld() {
		return shiftHeld;
	},
	get hoveredId() {
		return hoveredId;
	},
	isSelected,
	enter,
	toggle,
	add,
	selectRange,
	setSelection,
	startSelecting,
	setShiftHeld,
	setHovered,
	clear
};
