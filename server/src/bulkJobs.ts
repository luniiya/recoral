// Generic background job runner for any "apply this to N recording ids"
// bulk operation (trash/restore/archive/favorite/add-tag/delete-forever from
// multi-select), so the client fires one request and polls progress instead
// of looping one request per item itself (confirmed a real problem: a bulk
// operation over hundreds/thousands of recordings meant hundreds/thousands
// of individual requests hammering the server one at a time). Distinct from
// Empty Bin (recordings.ts's emptyTrashedRecordings/tags.ts's
// emptyTrashedTags), which stays a single instant DB transaction with no
// progress tracking at all, that operation genuinely has nothing gradual
// worth reporting. These do: a real "N of Total" the client can show,
// because the work itself (potentially file I/O for delete-forever, always
// at least one DB write per item) is real work, not a single atomic
// statement. Reusable across every bulk kind, a job doesn't know or care
// what `apply` actually does.
export interface BulkJob {
	id: string;
	userId: string;
	status: "processing" | "done";
	total: number;
	processed: number;
}

const jobs = new Map<string, BulkJob>();

// Yielding to the event loop between chunks (not after every single item,
// and not running the whole thing in one tight synchronous loop) keeps a
// huge job from blocking every other request on this single-threaded
// server, while still finishing about as fast as the underlying work
// actually allows.
const CHUNK_SIZE = 25;

async function runJob(job: BulkJob, ids: string[], apply: (id: string) => void | Promise<void>) {
	for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
		const chunk = ids.slice(i, i + CHUNK_SIZE);
		for (const id of chunk) {
			try {
				await apply(id);
			} catch {
				// One bad id (already deleted, belongs to someone else, whatever)
				// shouldn't take the rest of a thousand-item job down with it.
			}
			job.processed++;
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	job.status = "done";
	// Jobs are only ever polled for a few seconds after they finish (the
	// client stops once it sees "done"), no reason to hold onto them forever.
	setTimeout(() => jobs.delete(job.id), 60_000);
}

export function startBulkJob(userId: string, ids: string[], apply: (id: string) => void | Promise<void>): BulkJob {
	const job: BulkJob = { id: crypto.randomUUID(), userId, status: "processing", total: ids.length, processed: 0 };
	jobs.set(job.id, job);
	void runJob(job, ids, apply);
	return job;
}

export function getBulkJob(userId: string, jobId: string): BulkJob | null {
	const job = jobs.get(jobId);
	if (!job || job.userId !== userId) return null;
	return job;
}
