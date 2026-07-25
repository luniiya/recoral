import type { DisplayRecording } from './recordings.svelte';

export interface RecordingFilterState {
	search: string;
	tagIds: string[];
	dateFrom: string | null;
	dateTo: string | null;
}

function matchesSearch(r: DisplayRecording, query: string): boolean {
	if (!query) return true;
	return r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query);
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
		matchesSearch(r, filter.search.trim().toLowerCase()) &&
		matchesTags(r, filter.tagIds) &&
		matchesDateRange(r, filter.dateFrom, filter.dateTo)
	);
}

export function hasActiveRecordingFilter(filter: Pick<RecordingFilterState, 'tagIds' | 'dateFrom' | 'dateTo'>): boolean {
	return filter.tagIds.length > 0 || filter.dateFrom !== null || filter.dateTo !== null;
}
