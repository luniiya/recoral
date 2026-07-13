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
