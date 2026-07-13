export function formatDuration(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimestamp(iso: string, now = new Date()) {
	const date = new Date(iso);
	const includeYear = date.getFullYear() !== now.getFullYear();
	return date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: includeYear ? 'numeric' : undefined,
		hour: 'numeric',
		minute: '2-digit'
	});
}

// "July" for the current year, "2025 July" otherwise, same convention used
// throughout the app wherever a year needs to be disambiguated.
export function monthLabel(date: Date, now = new Date()) {
	const monthName = date.toLocaleDateString(undefined, { month: 'long' });
	return date.getFullYear() === now.getFullYear() ? monthName : `${date.getFullYear()} ${monthName}`;
}
