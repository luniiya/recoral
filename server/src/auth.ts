import type { User } from "@recoral/shared";
import { unlinkSync } from "node:fs";
import { db } from "./db";

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

export function userFromRequest(req: Request): User | null {
	const cookies = parseCookies(req.headers.get("cookie"));
	const token = cookies[SESSION_COOKIE];
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

export function updateAccount(userId: string, updates: { accentHue?: number; avatar?: string | null }): User {
	if (updates.accentHue !== undefined) {
		const hue = Math.round(((updates.accentHue % 360) + 360) % 360);
		db.run("UPDATE users SET accent_hue = ? WHERE id = ?", [hue, userId]);
	}
	if (updates.avatar !== undefined) {
		db.run("UPDATE users SET avatar = ? WHERE id = ?", [updates.avatar, userId]);
	}

	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!row) throw new Error("User not found");
	return toUser(row);
}

export function adminUpdateUser(
	userId: string,
	updates: { isAdmin?: boolean; storageLimitMb?: number | null }
): User {
	if (updates.isAdmin !== undefined) {
		db.run("UPDATE users SET is_admin = ? WHERE id = ?", [updates.isAdmin ? 1 : 0, userId]);
	}
	if (updates.storageLimitMb !== undefined) {
		db.run("UPDATE users SET storage_limit_mb = ? WHERE id = ?", [updates.storageLimitMb, userId]);
	}

	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(userId);
	if (!row) throw new Error("User not found");
	return toUser(row);
}

export function listUsers(): User[] {
	const rows = db.query<UserRow, []>("SELECT * FROM users ORDER BY created_at").all();
	return rows.map(toUser);
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
	if (!password) throw new Error("Password is required");

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
	const cookies = parseCookies(req.headers.get("cookie"));
	const token = cookies[SESSION_COOKIE];
	if (token) db.run("DELETE FROM sessions WHERE token = ?", [token]);
}
