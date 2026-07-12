import type { Recording } from "@recoral/shared";
import { clearSessionCookie, endSession, login, register, sessionCookie, userFromRequest } from "./auth";

const webDir = new URL("../../web/build/", import.meta.url);

async function readCredentials(req: Request) {
	const body = await req.json();
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const password = typeof body.password === "string" ? body.password : "";
	if (!email || !password) throw new Error("Email and password are required");
	return { email, password };
}

const server = Bun.serve({
	port: 3000,
	routes: {
		"/api/health": () => Response.json({ status: "ok" }),

		"/api/auth/register": {
			POST: async (req) => {
				try {
					const { email, password } = await readCredentials(req);
					const { user, token } = await register(email, password);
					return Response.json(user, { headers: { "Set-Cookie": sessionCookie(token) } });
				} catch (err) {
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/auth/login": {
			POST: async (req) => {
				try {
					const { email, password } = await readCredentials(req);
					const { user, token } = await login(email, password);
					return Response.json(user, { headers: { "Set-Cookie": sessionCookie(token) } });
				} catch (err) {
					return Response.json({ error: (err as Error).message }, { status: 401 });
				}
			}
		},

		"/api/auth/logout": {
			POST: (req) => {
				endSession(req);
				return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
			}
		},

		"/api/auth/me": (req) => {
			const user = userFromRequest(req);
			return user ? Response.json(user) : new Response(null, { status: 401 });
		},

		"/api/recordings": (req) => {
			const user = userFromRequest(req);
			if (!user) return new Response(null, { status: 401 });

			const recordings: Recording[] = [];
			return Response.json(recordings);
		}
	},
	async fetch(req) {
		const url = new URL(req.url);
		const filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
		const file = Bun.file(new URL(filePath, webDir));

		if (await file.exists()) return new Response(file);

		// SPA fallback so client-side routes resolve on refresh
		const index = Bun.file(new URL("index.html", webDir));
		if (await index.exists()) return new Response(index);

		return new Response("Not Found", { status: 404 });
	}
});

console.log(`recoral server listening on http://localhost:${server.port}`);
