import type { User } from "@recoral/shared";
import { db } from "./db";

const SESSION_COOKIE = "recoral_session";

interface UserRow {
	id: string;
	email: string;
	password_hash: string;
	created_at: string;
}

function toUser(row: UserRow): User {
	return { id: row.id, email: row.email, createdAt: row.created_at };
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

export async function register(email: string, password: string): Promise<{ user: User; token: string }> {
	const existing = db.query<{ id: string }, [string]>("SELECT id FROM users WHERE email = ?").get(email);
	if (existing) throw new Error("An account with that email already exists");

	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const passwordHash = await Bun.password.hash(password);

	db.run("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)", [
		id,
		email,
		passwordHash,
		createdAt
	]);

	return startSession({ id, email, createdAt } satisfies User);
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
	const row = db.query<UserRow, [string]>("SELECT * FROM users WHERE email = ?").get(email);
	if (!row) throw new Error("Invalid email or password");

	const valid = await Bun.password.verify(password, row.password_hash);
	if (!valid) throw new Error("Invalid email or password");

	return startSession(toUser(row));
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
