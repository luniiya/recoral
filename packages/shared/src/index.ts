export const APP_VERSION = "0.2.0";

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
