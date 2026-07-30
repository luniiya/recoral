export const APP_VERSION = "0.3.0";

// Letters/digits/underscore/dot/hyphen, 3-32 chars: matches the pattern/
// minlength/maxlength already live on the signup form's username input, just
// now also enforced server-side and on the admin create-user form. No '@' or
// whitespace, so a username can never collide with the "login accepts either
// username or email" lookup (auth.ts's login() queries
// `WHERE username = ? OR email = ?` against the same typed value, undefined
// which row wins if a username ever equalled a different user's email).
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

export function isValidUsername(username: string): boolean {
	return USERNAME_PATTERN.test(username);
}

export type TranscriptStatus = "none" | "pending" | "processing" | "done" | "failed";

export type TranscriptionModel = "tiny" | "base" | "small" | "medium" | "large";

export interface Recording {
	id: string;
	title: string;
	description: string;
	createdAt: string;
	durationSeconds: number;
	transcript: string | null;
	transcriptStatus: TranscriptStatus;
	favorite: boolean;
	archivedAt: string | null;
	trashedAt: string | null;
	tagIds: string[];
}

export interface User {
	id: string;
	username: string;
	email: string | null;
	createdAt: string;
	accentHue: number;
	avatar: string | null;
	isAdmin: boolean;
	storageLimitMb: number | null;
}

export interface Tag {
	id: string;
	name: string;
	hue: number;
	createdAt: string;
	trashedAt: string | null;
}

export interface Settings {
	defaultAccentHue: number | null;
	signupEnabled: boolean;
	backgroundImage: string | null;
	serverStorageLimitMb: number | null;
	maxImportSizeMb: number;
	transcriptionEnabled: boolean;
	transcriptionModel: TranscriptionModel;
}

export interface StorageUsage {
	usedBytes: number;
	limitMb: number | null;
}
