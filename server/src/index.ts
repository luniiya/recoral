import type { Recording } from "@recoral/shared";
import {
	clearSessionCookie,
	endSession,
	listUsers,
	login,
	register,
	sessionCookie,
	updateAccount,
	userFromRequest
} from "./auth";
import { createTag, deleteTag, listTags } from "./tags";

const webDir = new URL("../../web/build/", import.meta.url);
const MAX_AVATAR_LENGTH = 2_000_000; // ~1.5MB decoded, generous for a small profile picture

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

async function readRegisterBody(req: Request) {
	const body = await req.json();
	const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
	const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
	const password = typeof body.password === "string" ? body.password : "";
	const accentHue = typeof body.accentHue === "number" ? body.accentHue : undefined;

	if (!USERNAME_PATTERN.test(username)) {
		throw new Error("Username must be 3-32 characters, letters, numbers, dots, underscores or hyphens only");
	}
	if (!password) throw new Error("Password is required");

	return { username, email, password, accentHue };
}

async function readLoginBody(req: Request) {
	const body = await req.json();
	const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
	const password = typeof body.password === "string" ? body.password : "";
	if (!identifier || !password) throw new Error("Username/email and password are required");
	return { identifier, password };
}

function requireUser(req: Request) {
	const user = userFromRequest(req);
	if (!user) throw new UnauthorizedError();
	return user;
}

class UnauthorizedError extends Error {}

const server = Bun.serve({
	port: 3000,
	routes: {
		"/api/health": () => Response.json({ status: "ok" }),

		"/api/auth/register": {
			POST: async (req) => {
				try {
					const { username, email, password, accentHue } = await readRegisterBody(req);
					const { user, token } = await register(username, password, email, accentHue);
					return Response.json(user, { headers: { "Set-Cookie": sessionCookie(token) } });
				} catch (err) {
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/auth/login": {
			POST: async (req) => {
				try {
					const { identifier, password } = await readLoginBody(req);
					const { user, token } = await login(identifier, password);
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

		"/api/account": {
			PATCH: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const updates: { accentHue?: number; avatar?: string | null } = {};

					if (typeof body.accentHue === "number") updates.accentHue = body.accentHue;
					if (body.avatar === null) updates.avatar = null;
					else if (typeof body.avatar === "string") {
						if (body.avatar.length > MAX_AVATAR_LENGTH) {
							return Response.json({ error: "Image is too large" }, { status: 413 });
						}
						updates.avatar = body.avatar;
					}

					return Response.json(updateAccount(user.id, updates));
				} catch (err) {
					if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/tags": {
			GET: (req) => {
				try {
					return Response.json(listTags(requireUser(req).id));
				} catch {
					return new Response(null, { status: 401 });
				}
			},
			POST: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const name = typeof body.name === "string" ? body.name : "";
					const hue = typeof body.hue === "number" ? body.hue : 26;
					return Response.json(createTag(user.id, name, hue), { status: 201 });
				} catch (err) {
					if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/tags/:id": {
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					deleteTag(user.id, req.params.id);
					return new Response(null, { status: 204 });
				} catch {
					return new Response(null, { status: 401 });
				}
			}
		},

		"/api/admin/users": (req) => {
			const user = userFromRequest(req);
			if (!user) return new Response(null, { status: 401 });
			return Response.json(listUsers());
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
