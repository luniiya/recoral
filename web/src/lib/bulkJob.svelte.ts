import { api } from './api.svelte';

// Client-side tracking for server/src/bulkJobs.ts jobs: a multi-select bulk
// operation (trash/restore/archive/favorite/add-tag/delete-forever) starts
// one job server-side and this polls its real progress, instead of the
// client looping one request per recording itself (confirmed a real
// problem: a bulk op over hundreds/thousands of selected recordings meant
// hundreds/thousands of individual requests, some measured taking 3+
// seconds to resolve once they piled up). A plain array, not a single
// "current job": more than one huge operation can be in flight at once
// (e.g. bulk-tagging one big selection while a bulk-trash from a moment ago
// is still finishing), each tracked and polled independently.
export type BulkJobKind = 'trash' | 'restore' | 'archive' | 'unarchive' | 'favorite' | 'unfavorite' | 'addTag' | 'delete';

export interface TrackedBulkJob {
	id: string;
	kind: BulkJobKind;
	total: number;
	processed: number;
	status: 'processing' | 'done';
}

let jobs = $state<TrackedBulkJob[]>([]);

const POLL_INTERVAL_MS = 300;
// How long a finished job stays visible before disappearing, long enough to
// actually register as "done" rather than just vanishing mid-glance.
const DONE_LINGER_MS = 1200;

async function pollJob(jobId: string, onComplete?: () => void) {
	for (;;) {
		const res = await api.fetch(`/api/jobs/${jobId}`, { credentials: 'include' });
		if (!res.ok) {
			// Gone (expired server-side, or a network hiccup): stop polling
			// rather than looping forever on something that'll never resolve.
			jobs = jobs.filter((j) => j.id !== jobId);
			return;
		}
		const data: { total: number; processed: number; status: 'processing' | 'done' } = await res.json();
		jobs = jobs.map((j) => (j.id === jobId ? { ...j, total: data.total, processed: data.processed, status: data.status } : j));
		if (data.status === 'done') break;
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
	onComplete?.();
	setTimeout(() => {
		jobs = jobs.filter((j) => j.id !== jobId);
	}, DONE_LINGER_MS);
}

// Starts a job at `path` (POST, expects `{ jobId }` back) and begins
// tracking/polling it immediately. Resolves once the job is confirmed
// started, not once it finishes, callers that need to react to completion
// (typically: reload the affected store once the server-side state has
// actually settled) pass `onComplete`.
async function start(
	kind: BulkJobKind,
	path: string,
	body: unknown,
	total: number,
	onComplete?: () => void
): Promise<void> {
	if (total === 0) return;
	const res = await api.fetch(path, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) return;
	const { jobId } = (await res.json()) as { jobId: string };
	jobs = [...jobs, { id: jobId, kind, total, processed: 0, status: 'processing' }];
	void pollJob(jobId, onComplete);
}

export const bulkJobStore = {
	get jobs() {
		return jobs;
	},
	get active() {
		return jobs.length > 0;
	},
	// Combined across every concurrently-running job, for the compact mobile
	// indicator that takes over the Import button's slot, which only has
	// room for one fraction, not a whole stacked list, see
	// BulkJobToast.svelte for the full per-job breakdown used on desktop.
	get combinedProgress() {
		return jobs.reduce(
			(acc, j) => ({ processed: acc.processed + j.processed, total: acc.total + j.total }),
			{ processed: 0, total: 0 }
		);
	},
	start
};
