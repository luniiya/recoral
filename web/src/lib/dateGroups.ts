import type { Recording } from '@recoral/shared';
import { monthLabel } from './format';

export type TimelineRow =
	| { kind: 'month'; label: string; key: string }
	| { kind: 'day'; label: string; key: string }
	| { kind: 'recording'; recording: Recording; key: string };

function dayLabel(date: Date, now: Date): string {
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });
}

// Assumes recordings are already sorted newest-first. No separators before the
// very first recording, only at transitions from then on, photo-viewer style.
export function buildTimeline(recordings: Recording[], now = new Date()): TimelineRow[] {
	const rows: TimelineRow[] = [];
	let prev: Date | null = null;
	let sepCounter = 0;

	for (const recording of recordings) {
		const date = new Date(recording.createdAt);

		if (prev) {
			const yearChanged = date.getFullYear() !== prev.getFullYear();
			const monthChanged = yearChanged || date.getMonth() !== prev.getMonth();
			const dayChanged = monthChanged || date.getDate() !== prev.getDate();

			if (monthChanged) rows.push({ kind: 'month', label: monthLabel(date, now), key: `sep-${sepCounter++}` });
			if (dayChanged) rows.push({ kind: 'day', label: dayLabel(date, now), key: `sep-${sepCounter++}` });
		}

		rows.push({ kind: 'recording', recording, key: recording.id });
		prev = date;
	}

	return rows;
}

export interface ScrubberSegment {
	year: number;
	month: number;
	label: string;
	count: number;
	hasYearLabel: boolean;
}

// One segment per calendar month present, in list order (assumes newest-first
// sorted input), sized later by the caller based on `count` relative to the
// total. Only the first segment of each year gets `hasYearLabel`, so the
// scrubber shows a year mark exactly once per year, not once per month.
export function buildScrubberSegments(recordings: Recording[], now = new Date()): ScrubberSegment[] {
	const segments: ScrubberSegment[] = [];

	for (const recording of recordings) {
		const date = new Date(recording.createdAt);
		const year = date.getFullYear();
		const month = date.getMonth();
		const last = segments.at(-1);

		if (last && last.year === year && last.month === month) {
			last.count++;
			continue;
		}

		segments.push({
			year,
			month,
			label: monthLabel(date, now),
			count: 1,
			hasYearLabel: !last || last.year !== year
		});
	}

	return segments;
}
