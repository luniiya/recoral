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

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordCheckResult {
	valid: boolean;
	reason?: string;
}

function passwordClassCount(password: string): number {
	return [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
}

// Single source of truth for both the server (real enforcement) and every
// client form (instant feedback, identical wording), same precedent as
// isValidUsername above. requireStrong=false only enforces non-empty,
// matching the previous zero-validation behavior for servers that opted out
// via Settings.requireStrongPasswords.
export function validatePassword(password: string, requireStrong: boolean): PasswordCheckResult {
	if (!password) return { valid: false, reason: "Password is required" };
	if (!requireStrong) return { valid: true };
	if (password.length < MIN_PASSWORD_LENGTH || passwordClassCount(password) < 2) {
		return {
			valid: false,
			reason: "Password must be at least 8 characters and include at least 2 of: uppercase, lowercase, numbers, symbols"
		};
	}
	return { valid: true };
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
	usernameChangedAt: string | null;
}

// Self-service username changes are rate-limited to once per this many days
// (see updateAccount() in server/src/auth.ts), to stop someone from
// repeatedly swapping usernames to confuse other users.
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

// A logged-in device/browser, shown on the Sessions settings tab. `id` is a
// client-safe identifier, never the actual bearer token (see listSessions()
// in server/src/auth.ts).
export interface SessionSummary {
	id: string;
	createdAt: string;
	lastSeenAt: string | null;
	device: "mobile" | "desktop";
	label: string;
	current: boolean;
}

// Admin's user list needs storage/recording usage per user, on top of the
// plain User shape everyone else uses, so this is admin-route-only rather
// than added to User itself.
export interface AdminUserSummary extends User {
	recordingCount: number;
	storageUsedBytes: number;
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
	requireStrongPasswords: boolean;
	requireEmail: boolean;
}

export interface StorageUsage {
	usedBytes: number;
	limitMb: number | null;
}
