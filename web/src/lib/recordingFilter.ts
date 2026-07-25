import type { DisplayRecording } from './recordings.svelte';

// Which fields count as a match, toggleable in the filter panel. The server
// search endpoint takes the same three as query params, so switching one off
// means the same thing whether the local match or the server ends up
// answering, see recordings.svelte.ts.
export interface SearchFields {
	title: boolean;
	description: boolean;
	transcript: boolean;
}

export interface RecordingFilterState {
	search: string;
	searchFields: SearchFields;
	tagIds: string[];
	dateFrom: string | null;
	dateTo: string | null;
	// Ids the server confirmed match the *current* search query and field
	// scope (recordingsStore's serverSearchKey), or null if no server answer
	// for this exact combination has arrived yet (still in flight, offline,
	// or timed out). When present, it's authoritative instead of the local
	// substring check below, see recordings.svelte.ts's searchServer(). Today
	// the local check already covers everything (transcript included, the
	// whole library is always loaded client-side), so this rarely changes
	// what's shown, it's mainly forward-looking for whenever search needs to
	// cover data the client doesn't have loaded (see TODO.md's search section).
	serverSearchIds?: string[] | null;
}

function matchesSearch(
	r: DisplayRecording,
	query: string,
	fields: SearchFields,
	serverSearchIds?: string[] | null
): boolean {
	if (!query) return true;
	if (serverSearchIds) return serverSearchIds.includes(r.id);
	return (
		(fields.title && r.title.toLowerCase().includes(query)) ||
		(fields.description && r.description.toLowerCase().includes(query)) ||
		(fields.transcript && (r.transcript ?? '').toLowerCase().includes(query))
	);
}

function matchesTags(r: DisplayRecording, tagIds: string[]): boolean {
	return tagIds.length === 0 || tagIds.some((id) => r.tagIds.includes(id));
}

// Compared as a calendar day in the recording's own local time, not UTC, so
// a recording made late at night doesn't fall outside a range that visually
// includes that day.
function localDay(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchesDateRange(r: DisplayRecording, dateFrom: string | null, dateTo: string | null): boolean {
	if (!dateFrom && !dateTo) return true;
	const day = localDay(r.createdAt);
	if (dateFrom && day < dateFrom) return false;
	if (dateTo && day > dateTo) return false;
	return true;
}

// Shared by every page that lists recordings against the header filter panel
// (Recordings, Favourites, Archive), so search/tags/date range always behave
// identically everywhere that panel is visible, instead of each page
// reimplementing (and inevitably drifting from) the same predicate.
export function matchesRecordingFilter(r: DisplayRecording, filter: RecordingFilterState): boolean {
	return (
		matchesSearch(r, filter.search.trim().toLowerCase(), filter.searchFields, filter.serverSearchIds) &&
		matchesTags(r, filter.tagIds) &&
		matchesDateRange(r, filter.dateFrom, filter.dateTo)
	);
}

export function hasActiveRecordingFilter(filter: Pick<RecordingFilterState, 'tagIds' | 'dateFrom' | 'dateTo'>): boolean {
	return filter.tagIds.length > 0 || filter.dateFrom !== null || filter.dateTo !== null;
}
