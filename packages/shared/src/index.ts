export const APP_VERSION = "0.1.0";

export interface Recording {
	id: string;
	title: string;
	description: string;
	createdAt: string;
	durationSeconds: number;
	transcript: string | null;
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
}

export interface Settings {
	defaultAccentHue: number | null;
	signupEnabled: boolean;
	backgroundImage: string | null;
	serverStorageLimitMb: number | null;
}

export interface StorageUsage {
	usedBytes: number;
	limitMb: number | null;
}
