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
		trashed_at TEXT
	)
`);

// Older databases created `tags` with an inline UNIQUE(user_id, name), which
// would block reusing a trashed tag's name for a new active tag. bun:sqlite
// can't ALTER a constraint away, so rebuild the table without it the one time
// it's found, then rely on the partial index below for active-only uniqueness.
const tagsTableSql = db
	.query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tags'")
	.get();
if (tagsTableSql?.sql.includes("UNIQUE(user_id, name)")) {
	db.run("ALTER TABLE tags RENAME TO tags_old");
	db.run(`
		CREATE TABLE tags (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id),
			name TEXT NOT NULL,
			hue INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			trashed_at TEXT
		)
	`);
	db.run("INSERT INTO tags (id, user_id, name, hue, created_at) SELECT id, user_id, name, hue, created_at FROM tags_old");
	db.run("DROP TABLE tags_old");
}
ensureColumn("tags", "trashed_at", "trashed_at TEXT");
db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_active_name ON tags(user_id, name) WHERE trashed_at IS NULL");

db.run(`
	CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		default_accent_hue INTEGER,
		signup_enabled INTEGER NOT NULL DEFAULT 1,
		background_image TEXT,
		server_storage_limit_mb INTEGER DEFAULT 204800,
		max_import_size_mb INTEGER NOT NULL DEFAULT 1024,
		transcription_enabled INTEGER NOT NULL DEFAULT 1,
		transcription_model TEXT NOT NULL DEFAULT 'tiny'
	)
`);
db.run("INSERT OR IGNORE INTO settings (id, default_accent_hue, signup_enabled) VALUES (1, NULL, 1)");
ensureColumn("settings", "background_image", "background_image TEXT");
// 204800 MB = 200 GiB, the default total pool shared across every user on the server.
ensureColumn("settings", "server_storage_limit_mb", "server_storage_limit_mb INTEGER DEFAULT 204800");
// 1024 MB = 1 GiB, the default cap on a single Takeout/import upload.
ensureColumn("settings", "max_import_size_mb", "max_import_size_mb INTEGER NOT NULL DEFAULT 1024");
// On by default (an admin can flip it off in /admin). If the transcription
// Docker service isn't actually running, jobs just sit failed rather than
// breaking anything else.
ensureColumn("settings", "transcription_enabled", "transcription_enabled INTEGER NOT NULL DEFAULT 1");
ensureColumn("settings", "transcription_model", "transcription_model TEXT NOT NULL DEFAULT 'tiny'");

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
ensureColumn("recordings", "transcript_status", "transcript_status TEXT NOT NULL DEFAULT 'none'");
// Backfill: rows that already carry a transcript (e.g. from a Takeout import
// done before this column existed) should read as done, not none.
db.run("UPDATE recordings SET transcript_status = 'done' WHERE transcript IS NOT NULL AND transcript_status = 'none'");

db.run(`
	CREATE TABLE IF NOT EXISTS recording_tags (
		recording_id TEXT NOT NULL REFERENCES recordings(id),
		tag_id TEXT NOT NULL REFERENCES tags(id),
		PRIMARY KEY (recording_id, tag_id)
	)
`);
