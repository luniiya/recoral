export const APP_VERSION = "0.1.0";

export interface Recording {
	id: string;
	title: string;
	description: string | null;
	createdAt: string;
	durationSeconds: number;
	transcript: string | null;
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
}
