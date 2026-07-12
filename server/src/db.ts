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
ensureColumn("users", "is_admin", "is_admin INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "storage_limit_mb", "storage_limit_mb INTEGER");

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

db.run(`
	CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		default_accent_hue INTEGER,
		signup_enabled INTEGER NOT NULL DEFAULT 1,
		background_image TEXT,
		server_storage_limit_mb INTEGER DEFAULT 204800
	)
`);
db.run("INSERT OR IGNORE INTO settings (id, default_accent_hue, signup_enabled) VALUES (1, NULL, 1)");
ensureColumn("settings", "background_image", "background_image TEXT");
// 204800 MB = 200 GiB, the default total pool shared across every user on the server.
ensureColumn("settings", "server_storage_limit_mb", "server_storage_limit_mb INTEGER DEFAULT 204800");

db.run(`
	CREATE TABLE IF NOT EXISTS recordings (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		file_path TEXT NOT NULL,
		content_hash TEXT NOT NULL,
		duration_seconds REAL NOT NULL,
		file_size_bytes INTEGER NOT NULL,
		mime_type TEXT NOT NULL,
		favorite INTEGER NOT NULL DEFAULT 0,
		archived_at TEXT,
		trashed_at TEXT,
		created_at TEXT NOT NULL,
		transcript TEXT
	)
`);

db.run(`
	CREATE TABLE IF NOT EXISTS recording_tags (
		recording_id TEXT NOT NULL REFERENCES recordings(id),
		tag_id TEXT NOT NULL REFERENCES tags(id),
		PRIMARY KEY (recording_id, tag_id)
	)
`);
