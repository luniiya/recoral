import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });

export const db = new Database(`${dataDir}/recoral.sqlite`);
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE,
		password_hash TEXT NOT NULL,
		created_at TEXT NOT NULL,
		accent_hue INTEGER NOT NULL DEFAULT 26,
		avatar TEXT
	)
`);

// bun:sqlite has no ADD COLUMN IF NOT EXISTS, so migrate old databases by
// probing for the column and adding it once.
function ensureColumn(table: string, column: string, ddl: string) {
	const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
	if (!columns.some((c) => c.name === column)) db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn("users", "accent_hue", "accent_hue INTEGER NOT NULL DEFAULT 26");
ensureColumn("users", "avatar", "avatar TEXT");

db.run(`
	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		created_at TEXT NOT NULL
	)
`);

db.run(`
	CREATE TABLE IF NOT EXISTS tags (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		name TEXT NOT NULL,
		hue INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		UNIQUE(user_id, name)
	)
`);
