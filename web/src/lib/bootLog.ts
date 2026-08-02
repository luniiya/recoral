// Verbose, timestamped tracing for the app's startup path (root layout ->
// auth refresh -> tags/recordings load), specifically to diagnose why
// loading can take a long time or appear to hang when the server is
// unreachable vs. when the device itself has no network. Temporary
// diagnostic instrumentation, see CLAUDE.md's console.log policy: keep this
// in place across rebuilds until the slow-loading bug is actually confirmed
// fixed, don't strip it mid-investigation. Gated behind import.meta.env.DEV
// (true under `start-dev.sh`/`vite dev`, false and dead-code-eliminated in a
// real production build) instead, so it stays fully available while
// actively debugging without shipping into what an actual self-hosted user
// runs.
const bootStart = Date.now();

export function bootLog(...args: unknown[]) {
	if (import.meta.env.DEV) console.log(`[boot +${Date.now() - bootStart}ms]`, ...args);
}
