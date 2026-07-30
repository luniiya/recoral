import { isValidUsername, validatePassword, type User } from "@recoral/shared";
import { unlinkSync } from "node:fs";
import { db } from "./db";
import { getSettings } from "./settings";

const SESSION_COOKIE = "recoral_session";
const DEFAULT_ACCENT_HUE = 26;

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
		storageLimitMb: row.storage_limit_mb
	};
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
		.query<UserRow, [string]>(
			`SELECT users.* FROM sessions
			 JOIN users ON users.id = sessions.user_id
			 WHERE sessions.token = ?`
		)
		.get(token);

	return row ? toUser(row) : null;
}

export async function register(
	username: string,
	password: string,
	email: string | null,
	accentHue = DEFAULT_ACCENT_HUE
): Promise<{ user: User; token: string }> {
	if (!username) throw new Error("Username is required");
	if (!isValidUsername(username)) {
		throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
	}

	const passwordCheck = validatePassword(password, getSettings().requireStrongPasswords);
	if (!passwordCheck.valid) throw new Error(passwordCheck.reason);

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

	return startSession({
		id,
		username,
		email,
		createdAt,
		accentHue: hue,
		avatar: null,
		isAdmin: isFirstUser,
		storageLimitMb: null
	} satisfies User);
}

export async function login(identifier: string, password: string): Promise<{ user: User; token: string }> {
	const row = db
		.query<UserRow, [string, string]>("SELECT * FROM users WHERE username = ? OR email = ?")
		.get(identifier, identifier);
	if (!row) throw new Error("Invalid username/email or password");

	const valid = await Bun.password.verify(password, row.password_hash);
	if (!valid) throw new Error("Invalid username/email or password");

	return startSession(toUser(row));
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

	if (updates.username !== undefined) {
		if (!isValidUsername(updates.username)) {
			throw new Error("Username must be 3-32 characters: letters, numbers, ., - and _ only");
		}
		const existingUsername = db
			.query<{ id: string }, [string, string]>("SELECT id FROM users WHERE username = ? AND id != ?")
			.get(updates.username, userId);
		if (existingUsername) throw new Error("That username is already taken");
		db.run("UPDATE users SET username = ? WHERE id = ?", [updates.username, userId]);
	}

	if (updates.email !== undefined) {
		if (updates.email) {
			const existingEmail = db
				.query<{ id: string }, [string, string]>("SELECT id FROM users WHERE email = ? AND id != ?")
				.get(updates.email, userId);
			if (existingEmail) throw new Error("An account with that email already exists");
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

export function listUsers(): User[] {
	const rows = db.query<UserRow, []>("SELECT * FROM users ORDER BY created_at").all();
	return rows.map(toUser);
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

function startSession(user: User) {
	const token = crypto.randomUUID();
	db.run("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [
		token,
		user.id,
		new Date().toISOString()
	]);
	return { user, token };
}

export function endSession(req: Request) {
	const token = tokenFromRequest(req);
	if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}
