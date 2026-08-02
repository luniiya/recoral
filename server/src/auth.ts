import {
	isValidUsername,
	validatePassword,
	USERNAME_CHANGE_COOLDOWN_DAYS,
	type AdminUserSummary,
	type SessionSummary,
	type User
} from "@recoral/shared";
import { unlinkSync } from "node:fs";
import { db } from "./db";
import { getSettings } from "./settings";

const SESSION_COOKIE = "recoral_session";
const DEFAULT_ACCENT_HUE = 26;

// Only bumped once every this long per session, not on every single request,
// so an active session doesn't turn into a write on every API call.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

interface UserRow {
	id: string;
	username: string;
	email: string | null;
	password_hash: string;
	created_at: string;
	accent_hue: number;
	avatar: string | null;
	is_admin: number;
	storage_limit_mb: number | null;
	username_changed_at: string | null;
}

function toUser(row: UserRow): User {
	return {
		id: row.id,
		username: row.username,
		email: row.email,
		createdAt: row.created_at,
		accentHue: row.accent_hue,
		avatar: row.avatar,
		isAdmin: row.is_admin === 1,
		storageLimitMb: row.storage_limit_mb,
		usernameChangedAt: row.username_changed_at
	};
}

interface SessionRow {
	id: string;
	token: string;
	user_id: string;
	created_at: string;
	user_agent: string | null;
	last_seen_at: string | null;
}

// Server-side sniff rather than the client self-reporting its own platform:
// simpler (no client changes needed) and good enough for a phone-vs-desktop
// icon and a rough "Browser on OS" label, this isn't trying to be a precise
// analytics-grade UA parser.
function parseUserAgent(userAgent: string | null): { device: "mobile" | "desktop"; label: string } {
	if (!userAgent) return { device: "desktop", label: "Unknown device" };

	const isMobile = /Android|iPhone|iPad|Mobile/i.test(userAgent);

	let os = "Unknown OS";
	if (/Android/i.test(userAgent)) os = "Android";
	else if (/iPhone|iPad|iPod|iOS/i.test(userAgent)) os = "iOS";
	else if (/Windows/i.test(userAgent)) os = "Windows";
	else if (/Mac OS X|Macintosh/i.test(userAgent)) os = "macOS";
	else if (/Linux/i.test(userAgent)) os = "Linux";

	let browser = "Browser";
	if (/Edg\//i.test(userAgent)) browser = "Edge";
	else if (/OPR\//i.test(userAgent)) browser = "Opera";
	else if (/Firefox/i.test(userAgent)) browser = "Firefox";
	else if (/CriOS|Chrome/i.test(userAgent)) browser = "Chrome";
	else if (/Safari/i.test(userAgent)) browser = "Safari";

	return { device: isMobile ? "mobile" : "desktop", label: `${browser} on ${os}` };
}

export function parseCookies(header: string | null): Record<string, string> {
	const cookies: Record<string, string> = {};
	if (!header) return cookies;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key) cookies[key] = decodeURIComponent(rest.join("="));
	}
	return cookies;
}

export function sessionCookie(token: string) {
	return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`;
}

export function clearSessionCookie() {
	return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// Cookies work for the desktop webUI (always same-origin). Mobile is
// genuinely cross-origin (its own bundled WebView origin vs. a user-picked
// server), and SameSite=Lax cookies aren't reliably sent on cross-origin
// requests, so mobile authenticates via a bearer token instead, stored
// client-side and sent explicitly. Both are accepted here, either is fine.
export function tokenFromRequest(req: Request): string | null {
	const auth = req.headers.get("authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice(7);

	const cookies = parseCookies(req.headers.get("cookie"));
	if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];

	// <audio>/<img> elements load their src directly, with no way to attach
	// an Authorization header, so the audio route also accepts the token as
	// a query param for those specifically. Not used by normal apiFetch calls.
	return new URL(req.url).searchParams.get("token");
}

export function userFromRequest(req: Request): User | null {
	const token = tokenFromRequest(req);
	if (!token) return null;

	const row = db
		.query<UserRow & { last_seen_at: string | null }, [string]>(
			`SELECT users.*, sessions.last_seen_at FROM sessions
			 JOIN users ON users.id = sessions.user_id
			 WHERE sessions.token = ?`
		)
		.get(token);
	if (!row) return null;

	const lastSeenMs = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
	if (Date.now() - lastSeenMs > LAST_SEEN_THROTTLE_MS) {
		db.run("UPDATE sessions SET last_seen_at = ? WHERE token = ?", [new Date().toISOString(), token]);
	}

	return toUser(row);
}

export async function register(
	username: string,
	password: string,
	email: string | null,
	accentHue = DEFAULT_ACCENT_HUE,
	userAgent: string | null = null
): Promise<{ user: User; token: string }> {
	if (!username) throw new Error("Username is required");
	if (!isValidUsername(username)) {
		throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
	}

	const passwordCheck = validatePassword(password, getSettings().requireStrongPasswords);
	if (!passwordCheck.valid) throw new Error(passwordCheck.reason);

	if (!email && getSettings().requireEmail) throw new Error("Email is required");

	const existingUsername = db
		.query<{ id: string }, [string]>("SELECT id FROM users WHERE username = ?")
		.get(username);
	if (existingUsername) throw new Error("That username is already taken");

	if (email) {
		const existingEmail = db.query<{ id: string }, [string]>("SELECT id FROM users WHERE email = ?").get(email);
		if (existingEmail) throw new Error("An account with that email already exists");
	}

	const { count } = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM users").get()!;
	const isFirstUser = count === 0;

	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const passwordHash = await Bun.password.hash(password);
	const hue = Math.round(((accentHue % 360) + 360) % 360);

	db.run(
		"INSERT INTO users (id, username, email, password_hash, created_at, accent_hue, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)",
		[id, username, email, passwordHash, createdAt, hue, isFirstUser ? 1 : 0]
	);

	return startSession(
		{
			id,
			username,
			email,
			createdAt,
			accentHue: hue,
			avatar: null,
			isAdmin: isFirstUser,
			storageLimitMb: null,
			usernameChangedAt: null
		} satisfies User,
		userAgent
	);
}

interface LoginAttemptState {
	failCount: number;
	lockedUntil: number | null;
}

// In-memory only (resets on server restart) and keyed by the attempted
// identifier, not by IP: this server has no reverse-proxy-aware real-IP
// plumbing, and locking the *account* rather than the connection is what
// actually stops repeated guesses against one stolen/guessed username, which
// is the case that matters for a small self-hosted server like this.
const loginAttempts = new Map<string, LoginAttemptState>();

function checkLoginLockout(identifier: string) {
	const state = loginAttempts.get(identifier);
	if (state?.lockedUntil && Date.now() < state.lockedUntil) {
		const minutesLeft = Math.ceil((state.lockedUntil - Date.now()) / 60_000);
		throw new Error(`Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`);
	}
}

function recordLoginFailure(identifier: string) {
	const state = loginAttempts.get(identifier) ?? { failCount: 0, lockedUntil: null };
	state.failCount += 1;
	if (state.failCount >= MAX_LOGIN_ATTEMPTS) state.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
	loginAttempts.set(identifier, state);
}

export async function login(
	identifier: string,
	password: string,
	userAgent: string | null = null
): Promise<{ user: User; token: string }> {
	checkLoginLockout(identifier);

	const row = db
		.query<UserRow, [string, string]>("SELECT * FROM users WHERE username = ? OR email = ?")
		.get(identifier, identifier);
	if (!row) {
		recordLoginFailure(identifier);
		throw new Error("Invalid username/email or password");
	}

	const valid = await Bun.password.verify(password, row.password_hash);
	if (!valid) {
		recordLoginFailure(identifier);
		throw new Error("Invalid username/email or password");
	}

	loginAttempts.delete(identifier);
	return startSession(toUser(row), userAgent);
}

// username/email/password are "sensitive": changing any of them requires
// re-entering currentPassword first, proving it's really the account owner
// and not a hijacked/left-open session silently taking over the account
// (e.g. a changed password would otherwise lock the real owner out with no
// warning). accentHue/avatar stay frictionless, no currentPassword needed.
export async function updateAccount(
	userId: string,
	updates: {
		accentHue?: number;
		avatar?: string | null;
		username?: string;
		email?: string | null;
		password?: string;
		currentPassword?: string;
	}
): Promise<User> {
	const sensitiveChange =
		updates.username !== undefined || updates.email !== undefined || updates.password !== undefined;

	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!row) throw new Error("User not found");

	if (sensitiveChange) {
		if (!updates.currentPassword) throw new Error("Current password is required");
		const valid = await Bun.password.verify(updates.currentPassword, row.password_hash);
		if (!valid) throw new Error("Current password is incorrect");
	}

	if (updates.username !== undefined && updates.username !== row.username) {
		if (!isValidUsername(updates.username)) {
			throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
		}
		// Signup doesn't set username_changed_at, so the first self-service
		// change is always allowed immediately; only a prior change starts the
		// cooldown clock.
		if (row.username_changed_at) {
			const cooldownMs = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
			const nextEligible = new Date(row.username_changed_at).getTime() + cooldownMs;
			if (Date.now() < nextEligible) {
				const dateStr = new Date(nextEligible).toISOString().slice(0, 10);
				throw new Error(
					`You can only change your username once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days. Try again on ${dateStr}.`
				);
			}
		}
		const existingUsername = db
			.query<{ id: string }, [string, string]>("SELECT id FROM users WHERE username = ? AND id != ?")
			.get(updates.username, userId);
		if (existingUsername) throw new Error("That username is already taken");
		db.run("UPDATE users SET username = ?, username_changed_at = ? WHERE id = ?", [
			updates.username,
			new Date().toISOString(),
			userId
		]);
	}

	if (updates.email !== undefined) {
		if (updates.email) {
			const existingEmail = db
				.query<{ id: string }, [string, string]>("SELECT id FROM users WHERE email = ? AND id != ?")
				.get(updates.email, userId);
			if (existingEmail) throw new Error("An account with that email already exists");
		} else if (getSettings().requireEmail) {
			throw new Error("Email is required");
		}
		db.run("UPDATE users SET email = ? WHERE id = ?", [updates.email, userId]);
	}

	if (updates.password !== undefined) {
		const passwordCheck = validatePassword(updates.password, getSettings().requireStrongPasswords);
		if (!passwordCheck.valid) throw new Error(passwordCheck.reason);
		const passwordHash = await Bun.password.hash(updates.password);
		db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
	}

	if (updates.accentHue !== undefined) {
		const hue = Math.round(((updates.accentHue % 360) + 360) % 360);
		db.run("UPDATE users SET accent_hue = ? WHERE id = ?", [hue, userId]);
	}
	if (updates.avatar !== undefined) {
		db.run("UPDATE users SET avatar = ? WHERE id = ?", [updates.avatar, userId]);
	}

	const updatedRow = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!updatedRow) throw new Error("User not found");
	return toUser(updatedRow);
}

// No currentPassword needed here, unlike updateAccount above: this is an
// admin acting on a *different* user's account, already gated by
// requireAdmin server-side, not a self-service change needing re-auth.
export async function adminUpdateUser(
	userId: string,
	updates: { isAdmin?: boolean; storageLimitMb?: number | null; password?: string }
): Promise<User> {
	if (updates.isAdmin !== undefined) {
		db.run("UPDATE users SET is_admin = ? WHERE id = ?", [updates.isAdmin ? 1 : 0, userId]);
	}
	if (updates.storageLimitMb !== undefined) {
		db.run("UPDATE users SET storage_limit_mb = ? WHERE id = ?", [updates.storageLimitMb, userId]);
	}
	if (updates.password !== undefined) {
		const passwordCheck = validatePassword(updates.password, getSettings().requireStrongPasswords);
		if (!passwordCheck.valid) throw new Error(passwordCheck.reason);
		const passwordHash = await Bun.password.hash(updates.password);
		db.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
	}

	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!row) throw new Error("User not found");
	return toUser(row);
}

// Batched aggregates (one query each, not one per user) for the admin user
// list's storage/recording usage, same N+1 avoidance as recordings.ts's
// tagsByRecordingForUser.
export function listUsers(): AdminUserSummary[] {
	const rows = db.query<UserRow, []>("SELECT * FROM users ORDER BY created_at").all();
	const counts = db
		.query<{ user_id: string; count: number }, []>("SELECT user_id, COUNT(*) as count FROM recordings GROUP BY user_id")
		.all();
	const sums = db
		.query<{ user_id: string; total: number | null }, []>(
			"SELECT user_id, SUM(file_size_bytes) as total FROM recordings GROUP BY user_id"
		)
		.all();
	const countByUser = new Map(counts.map((c) => [c.user_id, c.count]));
	const bytesByUser = new Map(sums.map((s) => [s.user_id, s.total ?? 0]));
	return rows.map((row) => ({
		...toUser(row),
		recordingCount: countByUser.get(row.id) ?? 0,
		storageUsedBytes: bytesByUser.get(row.id) ?? 0
	}));
}

export function userCount(): number {
	return db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM users").get()!.count;
}

// Doesn't start a session for the new account, this is an admin creating an
// account for someone else, not logging in as them.
export async function adminCreateUser(
	username: string,
	password: string,
	email: string | null,
	isAdmin: boolean
): Promise<User> {
	if (!username) throw new Error("Username is required");
	if (!isValidUsername(username)) {
		throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
	}

	const passwordCheck = validatePassword(password, getSettings().requireStrongPasswords);
	if (!passwordCheck.valid) throw new Error(passwordCheck.reason);

	if (!email && getSettings().requireEmail) throw new Error("Email is required");

	const existingUsername = db
		.query<{ id: string }, [string]>("SELECT id FROM users WHERE username = ?")
		.get(username);
	if (existingUsername) throw new Error("That username is already taken");

	if (email) {
		const existingEmail = db.query<{ id: string }, [string]>("SELECT id FROM users WHERE email = ?").get(email);
		if (existingEmail) throw new Error("An account with that email already exists");
	}

	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const passwordHash = await Bun.password.hash(password);

	db.run(
		"INSERT INTO users (id, username, email, password_hash, created_at, accent_hue, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)",
		[id, username, email, passwordHash, createdAt, DEFAULT_ACCENT_HUE, isAdmin ? 1 : 0]
	);

	return toUser(db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(id)!);
}

// Cascades by hand since bun:sqlite doesn't have foreign keys turned on:
// audio files off disk, then recording_tags/recordings/tags/sessions rows,
// then the user row itself.
export function deleteUser(userId: string): void {
	const recordings = db
		.query<{ file_path: string }, [string]>("SELECT file_path FROM recordings WHERE user_id = ?")
		.all(userId);
	for (const recording of recordings) {
		try {
			unlinkSync(recording.file_path);
		} catch {
			// already gone, nothing to clean up
		}
	}

	db.run("DELETE FROM recording_tags WHERE recording_id IN (SELECT id FROM recordings WHERE user_id = ?)", [userId]);
	db.run("DELETE FROM recordings WHERE user_id = ?", [userId]);
	db.run("DELETE FROM tags WHERE user_id = ?", [userId]);
	db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
	db.run("DELETE FROM users WHERE id = ?", [userId]);
}

// A user deleting their own account, distinct from an admin deleting someone
// else's (deleteUser above, gated by requireAdmin server-side): requires
// re-entering currentPassword like every other sensitive self-service
// change, and refuses if this is the server's only remaining admin, since
// that would leave the whole server with no one able to administer it.
export async function deleteOwnAccount(userId: string, currentPassword: string): Promise<void> {
	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!row) throw new Error("User not found");

	const valid = await Bun.password.verify(currentPassword, row.password_hash);
	if (!valid) throw new Error("Current password is incorrect");

	if (row.is_admin === 1) {
		const { count } = db
			.query<{ count: number }, []>("SELECT COUNT(*) as count FROM users WHERE is_admin = 1")
			.get()!;
		if (count <= 1) throw new Error("You're the only admin, promote another user first");
	}

	deleteUser(userId);
}

function startSession(user: User, userAgent: string | null = null) {
	const id = crypto.randomUUID();
	const token = crypto.randomUUID();
	const now = new Date().toISOString();
	db.run(
		"INSERT INTO sessions (id, token, user_id, created_at, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
		[id, token, user.id, now, userAgent, now]
	);
	return { user, token };
}

export function endSession(req: Request) {
	const token = tokenFromRequest(req);
	if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}

// Never returns the real `token`, only the client-safe `id`: this list is
// rendered straight back to the user's own browser, and a live reusable
// bearer token has no business round-tripping through a JSON response.
export function listSessions(userId: string, currentToken: string | null): SessionSummary[] {
	const rows = db
		.query<SessionRow, [string]>(
			"SELECT * FROM sessions WHERE user_id = ? ORDER BY COALESCE(last_seen_at, created_at) DESC"
		)
		.all(userId);
	return rows.map((row) => {
		const { device, label } = parseUserAgent(row.user_agent);
		return {
			id: row.id,
			createdAt: row.created_at,
			lastSeenAt: row.last_seen_at,
			device,
			label,
			current: row.token === currentToken
		};
	});
}

export function revokeSession(userId: string, sessionId: string): void {
	db.run("DELETE FROM sessions WHERE id = ? AND user_id = ?", [sessionId, userId]);
}
