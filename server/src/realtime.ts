// Cross-device live updates: recording something on the phone should show up
// on the desktop webUI (and vice versa) without a manual refresh. A plain
// Server-Sent Events broadcast rather than a WebSocket, since this is
// one-directional (server -> client "something changed, go refetch") and SSE
// gets auto-reconnect and ordinary HTTP/cookie or ?token= auth for free,
// unlike a WebSocket upgrade. Payloads are deliberately just "recordings" or
// "tags" changed, not a diff, clients already have a plain load()/refetch for
// both (see recordingsStore/tagsStore), no separate sync protocol needed.
type EventType = "recordings" | "tags";

interface Client {
	userId: string;
	controller: ReadableStreamDefaultController<Uint8Array>;
}

const encoder = new TextEncoder();
const clients = new Set<Client>();

export function subscribe(userId: string): Response {
	let client: Client;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			client = { userId, controller };
			clients.add(client);
		},
		cancel() {
			clients.delete(client);
		}
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no"
		}
	});
}

export function broadcast(userId: string, type: EventType) {
	const payload = encoder.encode(`data: ${JSON.stringify({ type })}\n\n`);
	for (const client of clients) {
		if (client.userId !== userId) continue;
		try {
			client.controller.enqueue(payload);
		} catch {
			clients.delete(client);
		}
	}
}

// Idle SSE connections get silently killed by most reverse proxies (nginx,
// Caddy) after their own idle timeout, commonly well under a minute; a
// comment line every 20s keeps traffic flowing without EventSource treating
// it as a real message (comment lines starting with ':' are ignored by spec).
setInterval(() => {
	const ping = encoder.encode(`: ping\n\n`);
	for (const client of clients) {
		try {
			client.controller.enqueue(ping);
		} catch {
			clients.delete(client);
		}
	}
}, 20_000);
