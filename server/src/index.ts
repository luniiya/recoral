import { APP_VERSION, isValidUsername, type TranscriptionModel } from "@recoral/shared";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { getBulkJob, startBulkJob } from "./bulkJobs";
import {
	adminCreateUser,
	adminUpdateUser,
	clearSessionCookie,
	deleteOwnAccount,
	deleteUser,
	endSession,
	listSessions,
	listUsers,
	login,
	register,
	revokeSession,
	sessionCookie,
	tokenFromRequest,
	updateAccount,
	userCount,
	userFromRequest
} from "./auth";
import {
	attachTag as attachRecordingTag,
	checkStorageQuota,
	createRecording,
	deleteRecording,
	detachTag as detachRecordingTag,
	DuplicateError,
	emptyTrashedRecordings,
	getAudioFile,
	getRecording,
	globalStorageBytes,
	listRecordings,
	purgeExpiredTrash,
	QuotaError,
	searchRecordings,
	updateRecording,
	userStorageBytes
} from "./recordings";
import { buildExportArchive, getExportStats } from "./dataExport";
import { getRecoralImportJob, startRecoralImport } from "./recoralImport";
import { subscribe as subscribeToEvents } from "./realtime";
import { getSettings, updateSettings } from "./settings";
import { getImportJob, startTakeoutImport } from "./takeoutImport";
import { createTag, deleteTagForever, emptyTrashedTags, listTags, purgeExpiredTagTrash, updateTag } from "./tags";
import { enqueueAllUntranscribed, enqueueTranscription, requeueStuckTranscriptions } from "./transcription";

const webDir = new URL("../../web/build/", import.meta.url);
const MAX_AVATAR_LENGTH = 2_000_000; // ~1.5MB decoded, generous for a small profile picture
const MAX_BACKGROUND_LENGTH = 22_369_622; // 16MiB decoded (base64 inflates by 4/3), a full-bleed page background needs more room

const TRANSCRIPTION_MODELS: TranscriptionModel[] = ["tiny", "base", "small", "medium", "large"];

async function readRegisterBody(req: Request) {
	const body = await req.json();
	const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
	const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
	const password = typeof body.password === "string" ? body.password : "";
	const accentHue = typeof body.accentHue === "number" ? body.accentHue : undefined;

	if (!isValidUsername(username)) {
		throw new Error("Username must be 3-32 characters, letters, numbers, dots, underscores or hyphens only");
	}
	// Password strength (empty vs. weak vs. the requireStrongPasswords toggle)
	// is all enforced inside register() itself, the single source of truth,
	// no need to duplicate any of that check here.

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

function requireAdmin(req: Request) {
	const user = requireUser(req);
	if (!user.isAdmin) throw new ForbiddenError();
	return user;
}

class UnauthorizedError extends Error {}
class ForbiddenError extends Error {}

function authErrorResponse(err: unknown) {
	if (err instanceof ForbiddenError) return new Response(null, { status: 403 });
	if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
	// Anything else here is an actual bug, not an auth failure, log it so it
	// shows up in the terminal running the server instead of silently
	// surfacing to the client as a generic 401/400.
	console.error(err);
	return null;
}

// Only needed for the mobile app: it's loaded from a local WebView origin and
// talks to a genuinely different, user-picked server origin, unlike the
// desktop webUI (always same-origin, never needed this before). Reflects the
// request's own Origin back rather than a fixed value since the server
// itself has no way to know every mobile client's origin in advance, and
// credentialed requests can't use a wildcard "*" anyway.
const CORS_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization";

function corsHeaders(origin: string | null): HeadersInit {
	if (!origin) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Credentials": "true",
		Vary: "Origin"
	};
}

function preflightResponse(origin: string | null) {
	return new Response(null, {
		status: 204,
		headers: {
			...corsHeaders(origin),
			"Access-Control-Allow-Methods": CORS_METHODS,
			"Access-Control-Allow-Headers": CORS_HEADERS
		}
	});
}

type RouteHandler = (req: never) => Response | Promise<Response>;
type RouteValue = RouteHandler | Record<string, RouteHandler>;

// Previously the server logged almost nothing during normal operation (one
// line at startup, plus a couple of console.error calls in specific
// catch blocks), so `docker logs` looked empty even while the server was
// actively handling traffic, no way to tell "no requests are arriving" from
// "requests are arriving and working fine." One line per request here
// fixes that for every route this app actually has (all of them go through
// withCors). Deliberately unconditional (no log-level toggle), this is a
// small self-hosted server, not something logging at a rate worth gating.
function logRequest(req: Request, res: Response, startedAt: number) {
	const ms = Math.round(performance.now() - startedAt);
	console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} ${ms}ms`);
}

function withCors<T extends Record<string, RouteValue>>(routes: T): T {
	const wrapped: Record<string, RouteValue> = {};

	for (const [path, value] of Object.entries(routes)) {
		if (typeof value === "function") {
			wrapped[path] = async (req: Request) => {
				const origin = req.headers.get("origin");
				if (req.method === "OPTIONS") return preflightResponse(origin);
				const startedAt = performance.now();
				const res = await value(req as never);
				logRequest(req, res, startedAt);
				for (const [key, val] of Object.entries(corsHeaders(origin))) res.headers.set(key, val as string);
				return res;
			};
		} else {
			const methods: Record<string, RouteHandler> = {};
			for (const [method, fn] of Object.entries(value)) {
				methods[method] = async (req: Request) => {
					const origin = req.headers.get("origin");
					const startedAt = performance.now();
					const res = await fn(req as never);
					logRequest(req, res, startedAt);
					for (const [key, val] of Object.entries(corsHeaders(origin))) res.headers.set(key, val as string);
					return res;
				};
			}
			methods.OPTIONS = (req: Request) => preflightResponse(req.headers.get("origin"));
			wrapped[path] = methods;
		}
	}

	return wrapped as T;
}

const server = Bun.serve({
	port: Number(process.env.PORT) || 7245,
	// Bun's default is 128MiB, which a real Google Takeout export (hundreds
	// of recordings) blows past easily. This is just the hard technical
	// ceiling; the actual admin-configurable limit (Settings.maxImportSizeMb,
	// default 1GiB) is enforced in the /api/import/takeout route itself.
	maxRequestBodySize: 10 * 1024 * 1024 * 1024,
	// Bun's default idle timeout is 10s. /api/export streams a zip of the
	// user's whole library (dataExport.ts), which for a four-figure library
	// can go quiet for longer than that while archiving/compressing between
	// flushed chunks, confirmed via a real "request timed out after 10
	// seconds" log killing the connection with nothing ever reaching the
	// browser. 255 is the max Bun allows (stored as a single byte internally).
	idleTimeout: 255,
	routes: withCors({
		"/api/health": () => Response.json({ status: "ok", version: APP_VERSION }),

		"/api/auth/register": {
			POST: async (req) => {
				try {
					if (!getSettings().signupEnabled) {
						return Response.json({ error: "Sign ups are currently disabled" }, { status: 403 });
					}
					const { username, email, password, accentHue } = await readRegisterBody(req);
					const { user, token } = await register(
						username,
						password,
						email,
						accentHue,
						req.headers.get("user-agent")
					);
					return Response.json({ ...user, token }, { headers: { "Set-Cookie": sessionCookie(token) } });
				} catch (err) {
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/auth/login": {
			POST: async (req) => {
				try {
					const { identifier, password } = await readLoginBody(req);
					const { user, token } = await login(identifier, password, req.headers.get("user-agent"));
					return Response.json({ ...user, token }, { headers: { "Set-Cookie": sessionCookie(token) } });
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
					const updates: {
						accentHue?: number;
						avatar?: string | null;
						username?: string;
						email?: string | null;
						password?: string;
						currentPassword?: string;
					} = {};

					if (typeof body.accentHue === "number") updates.accentHue = body.accentHue;
					if (body.avatar === null) updates.avatar = null;
					else if (typeof body.avatar === "string") {
						if (body.avatar.length > MAX_AVATAR_LENGTH) {
							return Response.json({ error: "Image is too large" }, { status: 413 });
						}
						updates.avatar = body.avatar;
					}
					if (typeof body.username === "string") updates.username = body.username.trim().toLowerCase();
					if (body.email === null) updates.email = null;
					else if (typeof body.email === "string" && body.email.trim()) {
						updates.email = body.email.trim().toLowerCase();
					}
					if (typeof body.password === "string" && body.password) updates.password = body.password;
					if (typeof body.currentPassword === "string") updates.currentPassword = body.currentPassword;

					return Response.json(await updateAccount(user.id, updates));
				} catch (err) {
					if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			},
			DELETE: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json().catch(() => ({}));
					const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
					await deleteOwnAccount(user.id, currentPassword);
					return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
				} catch (err) {
					if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/account/sessions": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					return Response.json(listSessions(user.id, tokenFromRequest(req)));
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/account/sessions/:id": {
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					revokeSession(user.id, req.params.id);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/tags": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					purgeExpiredTagTrash();
					return Response.json(listTags(user.id));
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
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
			PATCH: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const updates: { name?: string; hue?: number; trashed?: boolean } = {};
					if (typeof body.name === "string") updates.name = body.name;
					if (typeof body.hue === "number") updates.hue = body.hue;
					if (typeof body.trashed === "boolean") updates.trashed = body.trashed;
					return Response.json(updateTag(user.id, req.params.id, updates));
				} catch (err) {
					if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
					return Response.json({ error: (err as Error).message }, { status: 400 });
				}
			},
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					deleteTagForever(user.id, req.params.id);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/admin/users": {
			GET: (req) => {
				try {
					requireAdmin(req);
					return Response.json(listUsers());
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			},
			POST: async (req) => {
				try {
					requireAdmin(req);
					const body = await req.json();
					const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
					const email =
						typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
					const password = typeof body.password === "string" ? body.password : "";
					const isAdmin = body.isAdmin === true;

					if (!isValidUsername(username)) {
						return Response.json(
							{ error: "Username must be 3-32 characters, letters, numbers, dots, underscores or hyphens only" },
							{ status: 400 }
						);
					}

					const user = await adminCreateUser(username, password, email, isAdmin);
					return Response.json(user, { status: 201 });
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/admin/users/:id": {
			PATCH: async (req) => {
				try {
					const admin = requireAdmin(req);
					const body = await req.json();
					const updates: { isAdmin?: boolean; storageLimitMb?: number | null; password?: string } = {};

					if (typeof body.isAdmin === "boolean") {
						if (req.params.id === admin.id && body.isAdmin === false) {
							return Response.json({ error: "You can't remove your own admin access" }, { status: 400 });
						}
						updates.isAdmin = body.isAdmin;
					}
					if (body.storageLimitMb === null || typeof body.storageLimitMb === "number") {
						updates.storageLimitMb = body.storageLimitMb;
					}
					if (typeof body.password === "string" && body.password) updates.password = body.password;

					return Response.json(await adminUpdateUser(req.params.id, updates));
				} catch (err) {
					// A plain thrown Error here (weak password, "User not found") is a
					// real validation message the client should see, not an auth
					// failure, so this now matches the same fallback shape /api/account
					// and other mutating routes already use instead of a blank 401.
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			},
			DELETE: (req) => {
				try {
					const admin = requireAdmin(req);
					if (req.params.id === admin.id) {
						return Response.json({ error: "You can't delete your own account" }, { status: 400 });
					}
					deleteUser(req.params.id);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/settings": () => Response.json(getSettings()),

		"/api/setup-status": () => Response.json({ needsSetup: userCount() === 0 }),

		"/api/admin/settings": {
			PATCH: async (req) => {
				try {
					requireAdmin(req);
					const body = await req.json();
					const updates: {
						defaultAccentHue?: number | null;
						signupEnabled?: boolean;
						backgroundImage?: string | null;
						serverStorageLimitMb?: number | null;
						maxImportSizeMb?: number;
						transcriptionEnabled?: boolean;
						transcriptionModel?: TranscriptionModel;
						requireStrongPasswords?: boolean;
						requireEmail?: boolean;
					} = {};

					if (body.defaultAccentHue === null || typeof body.defaultAccentHue === "number") {
						updates.defaultAccentHue = body.defaultAccentHue;
					}
					if (typeof body.signupEnabled === "boolean") updates.signupEnabled = body.signupEnabled;
					if (body.backgroundImage === null) updates.backgroundImage = null;
					else if (typeof body.backgroundImage === "string") {
						if (body.backgroundImage.length > MAX_BACKGROUND_LENGTH) {
							return Response.json({ error: "Image is too large" }, { status: 413 });
						}
						updates.backgroundImage = body.backgroundImage;
					}
					if (body.serverStorageLimitMb === null || typeof body.serverStorageLimitMb === "number") {
						updates.serverStorageLimitMb = body.serverStorageLimitMb;
					}
					if (typeof body.maxImportSizeMb === "number" && body.maxImportSizeMb > 0) {
						updates.maxImportSizeMb = Math.min(body.maxImportSizeMb, 10240);
					}
					if (typeof body.transcriptionEnabled === "boolean") {
						updates.transcriptionEnabled = body.transcriptionEnabled;
					}
					if (TRANSCRIPTION_MODELS.includes(body.transcriptionModel)) {
						updates.transcriptionModel = body.transcriptionModel;
					}
					if (typeof body.requireStrongPasswords === "boolean") {
						updates.requireStrongPasswords = body.requireStrongPasswords;
					}
					if (typeof body.requireEmail === "boolean") {
						updates.requireEmail = body.requireEmail;
					}

					const newSettings = updateSettings(updates);
					// Covers both "just turned transcription on" (nothing's been
					// queued for any pre-existing recording yet) and "already on,
					// something else changed" (harmless no-op, listUntranscribed()
					// only returns recordings that never actually finished).
					enqueueAllUntranscribed();
					return Response.json(newSettings);
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/recordings": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					purgeExpiredTrash();
					return Response.json(listRecordings(user.id));
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			},
			POST: async (req) => {
				try {
					const user = requireUser(req);
					const form = await req.formData();
					const file = form.get("file");
					const title = form.get("title");
					const description = form.get("description");
					const durationSeconds = Number(form.get("durationSeconds") ?? 0);

					if (!(file instanceof File)) return Response.json({ error: "A file is required" }, { status: 400 });

					checkStorageQuota(user.id, user.storageLimitMb, file.size);

					const recording = await createRecording({
						userId: user.id,
						title: typeof title === "string" ? title.trim() : "",
						description: typeof description === "string" ? description.trim() : undefined,
						file,
						durationSeconds
					});
					if (!recording.transcript) {
						enqueueTranscription(recording.id);
						// enqueueTranscription() already wrote "pending" (or left it
						// "none" if transcription is off) straight to the db; reflect
						// that in the response instead of the now-stale snapshot
						// createRecording() returned before the enqueue call.
						if (getSettings().transcriptionEnabled) recording.transcriptStatus = "pending";
					}
					return Response.json(recording, { status: 201 });
				} catch (err) {
					if (err instanceof DuplicateError) {
						return Response.json({ error: err.message, existing: err.existing }, { status: 409 });
					}
					if (err instanceof QuotaError) return Response.json({ error: err.message }, { status: 413 });
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		// Server-side search: the client always searches its own already-loaded
		// copy first (instant, see recordingFilter.ts), then reconciles with
		// this once it answers. Exists mainly so search can eventually cover
		// data the client doesn't have loaded in bulk, not because today's
		// client-side match is missing anything, see TODO.md. title/
		// description/transcript params each default to "on" (true unless
		// explicitly "0") so the endpoint still searches everything if called
		// without them, matching searchRecordings()'s own defaults.
		"/api/recordings/search": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const url = new URL(req.url);
					const query = url.searchParams.get("q")?.trim() ?? "";
					if (!query) return Response.json([]);
					const fields = {
						title: url.searchParams.get("title") !== "0",
						description: url.searchParams.get("description") !== "0",
						transcript: url.searchParams.get("transcript") !== "0"
					};
					return Response.json(searchRecordings(user.id, query, fields));
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/recordings/:id": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const recording = getRecording(user.id, req.params.id);
					if (!recording) return new Response(null, { status: 404 });
					return Response.json(recording);
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			},
			PATCH: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const updates: {
						title?: string;
						description?: string;
						favorite?: boolean;
						archived?: boolean;
						trashed?: boolean;
					} = {};

					if (typeof body.title === "string") updates.title = body.title;
					if (typeof body.description === "string") updates.description = body.description;
					if (typeof body.favorite === "boolean") updates.favorite = body.favorite;
					if (typeof body.archived === "boolean") updates.archived = body.archived;
					if (typeof body.trashed === "boolean") updates.trashed = body.trashed;

					return Response.json(updateRecording(user.id, req.params.id, updates));
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			},
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					deleteRecording(user.id, req.params.id);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		// "Empty Bin": permanently deletes every trashed recording and tag in
		// one request, not one DELETE per item from the client (see
		// emptyTrashedRecordings/emptyTrashedTags, both batched into a single
		// DB transaction each).
		"/api/bin": {
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					emptyTrashedRecordings(user.id);
					emptyTrashedTags(user.id);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		// Multi-select bulk operations (trash/restore/archive/favorite, add-tag,
		// delete-forever): one request starts a background job over however many
		// ids were selected, the client polls /api/jobs/:id for real progress
		// instead of firing one request per recording itself, see bulkJobs.ts.
		// Unlike Empty Bin above, these are genuinely gradual (real DB writes,
		// sometimes real file I/O), worth reporting real progress for, at real
		// scale (hundreds to thousands of selected recordings).
		"/api/recordings/bulk": {
			POST: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
					const updates: { trashed?: boolean; archived?: boolean; favorite?: boolean } = {};
					if (typeof body.trashed === "boolean") updates.trashed = body.trashed;
					if (typeof body.archived === "boolean") updates.archived = body.archived;
					if (typeof body.favorite === "boolean") updates.favorite = body.favorite;
					const job = startBulkJob(user.id, ids, (id) => void updateRecording(user.id, id, updates));
					return Response.json({ jobId: job.id }, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/recordings/bulk-delete": {
			POST: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
					const job = startBulkJob(user.id, ids, (id) => deleteRecording(user.id, id));
					return Response.json({ jobId: job.id }, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		// Ancestor tag ids are resolved client-side (tagPath.ts's
		// ancestorTagIds(), the same hierarchy-from-name parsing the rest of the
		// app already relies on) and sent as one flat tagIds list here, the same
		// list applies to every selected recording, computing it once client-
		// side beats re-deriving it per recording server-side for no benefit.
		"/api/recordings/bulk-tag": {
			POST: async (req) => {
				try {
					const user = requireUser(req);
					const body = await req.json();
					const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
					const tagIds = Array.isArray(body.tagIds) ? (body.tagIds as string[]) : [];
					const job = startBulkJob(user.id, ids, (id) => {
						for (const tagId of tagIds) attachRecordingTag(user.id, id, tagId);
					});
					return Response.json({ jobId: job.id }, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/jobs/:id": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const job = getBulkJob(user.id, req.params.id);
					if (!job) return new Response(null, { status: 404 });
					return Response.json(job);
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		// A plain GET, not `requireUser`'s throw/catch shape, since EventSource
		// can't read a JSON error body anyway, an outright 401 is enough for it
		// to stop retrying with the same bad token.
		"/api/events": (req) => {
			const user = userFromRequest(req);
			if (!user) return new Response(null, { status: 401 });
			return subscribeToEvents(user.id);
		},

		"/api/recordings/:id/audio": (req) => {
			const user = userFromRequest(req);
			if (!user) return new Response(null, { status: 401 });

			const audio = getAudioFile(user.id, req.params.id);
			if (!audio) return new Response(null, { status: 404 });

			return new Response(Bun.file(audio.path), { headers: { "Content-Type": audio.mimeType } });
		},

		"/api/recordings/:id/transcribe": {
			POST: (req) => {
				try {
					const user = requireUser(req);
					if (!getAudioFile(user.id, req.params.id)) return new Response(null, { status: 404 });
					if (!getSettings().transcriptionEnabled) {
						return Response.json({ error: "Transcription isn't enabled on this server" }, { status: 400 });
					}
					enqueueTranscription(req.params.id);
					return new Response(null, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/recordings/:id/tags/:tagId": {
			POST: (req) => {
				try {
					const user = requireUser(req);
					attachRecordingTag(user.id, req.params.id, req.params.tagId);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			},
			DELETE: (req) => {
				try {
					const user = requireUser(req);
					detachRecordingTag(user.id, req.params.id, req.params.tagId);
					return new Response(null, { status: 204 });
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/storage": (req) => {
			try {
				const user = requireUser(req);
				if (user.storageLimitMb !== null) {
					return Response.json({ usedBytes: userStorageBytes(user.id), limitMb: user.storageLimitMb });
				}
				return Response.json({
					usedBytes: globalStorageBytes(),
					limitMb: getSettings().serverStorageLimitMb
				});
			} catch (err) {
				return authErrorResponse(err) ?? new Response(null, { status: 401 });
			}
		},

		"/api/import/takeout": {
			POST: async (req) => {
				try {
					const user = requireUser(req);

					// Check Content-Length against the admin-configured limit before
					// parsing the multipart body, so an oversized upload is rejected
					// without first buffering the whole thing into memory.
					const contentLength = Number(req.headers.get("content-length") ?? 0);
					const maxImportSizeMb = getSettings().maxImportSizeMb;
					if (contentLength > maxImportSizeMb * 1024 * 1024) {
						return Response.json(
							{ error: `That file is larger than the ${maxImportSizeMb}MB import limit set by your server admin` },
							{ status: 413 }
						);
					}

					const form = await req.formData();
					const file = form.get("file");
					if (!(file instanceof File)) {
						return Response.json({ error: "A Google Takeout .zip file is required" }, { status: 400 });
					}

					const zipPath = join(tmpdir(), `recoral-takeout-${crypto.randomUUID()}.zip`);
					await Bun.write(zipPath, file);

					const jobId = startTakeoutImport(user.id, user.storageLimitMb, zipPath);
					return Response.json({ jobId }, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/import/takeout/:jobId": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const job = getImportJob(user.id, req.params.jobId);
					if (!job) return new Response(null, { status: 404 });
					return Response.json(job);
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/import/recoral": {
			POST: async (req) => {
				try {
					const user = requireUser(req);

					const contentLength = Number(req.headers.get("content-length") ?? 0);
					const maxImportSizeMb = getSettings().maxImportSizeMb;
					if (contentLength > maxImportSizeMb * 1024 * 1024) {
						return Response.json(
							{ error: `That file is larger than the ${maxImportSizeMb}MB import limit set by your server admin` },
							{ status: 413 }
						);
					}

					const form = await req.formData();
					const file = form.get("file");
					if (!(file instanceof File)) {
						return Response.json({ error: "A recoral export .zip file is required" }, { status: 400 });
					}

					const zipPath = join(tmpdir(), `recoral-import-${crypto.randomUUID()}.zip`);
					await Bun.write(zipPath, file);

					const jobId = startRecoralImport(user.id, user.storageLimitMb, zipPath);
					return Response.json({ jobId }, { status: 202 });
				} catch (err) {
					return authErrorResponse(err) ?? Response.json({ error: (err as Error).message }, { status: 400 });
				}
			}
		},

		"/api/import/recoral/:jobId": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const job = getRecoralImportJob(user.id, req.params.jobId);
					if (!job) return new Response(null, { status: 404 });
					return Response.json(job);
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/export/stats": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					return Response.json(getExportStats(user.id));
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		},

		"/api/export": {
			GET: (req) => {
				try {
					const user = requireUser(req);
					const archive = buildExportArchive(user.id);
					const filename = `recoral-export-${new Date().toISOString().slice(0, 10)}.zip`;
					return new Response(Readable.toWeb(archive) as ReadableStream, {
						headers: {
							"Content-Type": "application/zip",
							"Content-Disposition": `attachment; filename="${filename}"`
						}
					});
				} catch (err) {
					return authErrorResponse(err) ?? new Response(null, { status: 401 });
				}
			}
		}
	}),
	async fetch(req) {
		const url = new URL(req.url);
		const filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
		const file = Bun.file(new URL(filePath, webDir));

		if (await file.exists()) return new Response(file);

		// SPA fallback so client-side routes resolve on refresh
		const index = Bun.file(new URL("index.html", webDir));
		if (await index.exists()) return new Response(index);

		return new Response("Not Found", { status: 404 });
	},
	error(err) {
		console.error(err);
		return new Response("Internal Server Error", { status: 500 });
	}
});

requeueStuckTranscriptions();
enqueueAllUntranscribed();

console.log(`recoral server listening on http://localhost:${server.port}`);
