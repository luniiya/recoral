import type { Settings, TranscriptionModel } from "@recoral/shared";
import { db } from "./db";

const TRANSCRIPTION_MODELS: TranscriptionModel[] = ["tiny", "base", "small", "medium", "large"];

interface SettingsRow {
	id: number;
	default_accent_hue: number | null;
	signup_enabled: number;
	background_image: string | null;
	server_storage_limit_mb: number | null;
	max_import_size_mb: number;
	transcription_enabled: number;
	transcription_model: string;
	require_strong_passwords: number;
	require_email: number;
}

function toSettings(row: SettingsRow): Settings {
	return {
		defaultAccentHue: row.default_accent_hue,
		signupEnabled: row.signup_enabled === 1,
		backgroundImage: row.background_image,
		serverStorageLimitMb: row.server_storage_limit_mb,
		maxImportSizeMb: row.max_import_size_mb,
		transcriptionEnabled: row.transcription_enabled === 1,
		transcriptionModel: (TRANSCRIPTION_MODELS as string[]).includes(row.transcription_model)
			? (row.transcription_model as TranscriptionModel)
			: "tiny",
		requireStrongPasswords: row.require_strong_passwords === 1,
		requireEmail: row.require_email === 1
	};
}

export function getSettings(): Settings {
	const row = db.query<SettingsRow, []>("SELECT * FROM settings WHERE id = 1").get();
	return row
		? toSettings(row)
		: {
				defaultAccentHue: null,
				signupEnabled: true,
				backgroundImage: null,
				serverStorageLimitMb: 204800,
				maxImportSizeMb: 1024,
				transcriptionEnabled: true,
				transcriptionModel: "tiny",
				requireStrongPasswords: true,
				requireEmail: false
			};
}

export function updateSettings(updates: {
	defaultAccentHue?: number | null;
	signupEnabled?: boolean;
	backgroundImage?: string | null;
	serverStorageLimitMb?: number | null;
	maxImportSizeMb?: number;
	transcriptionEnabled?: boolean;
	transcriptionModel?: TranscriptionModel;
	requireStrongPasswords?: boolean;
	requireEmail?: boolean;
}): Settings {
	if (updates.defaultAccentHue !== undefined) {
		const hue =
			updates.defaultAccentHue === null
				? null
				: Math.round(((updates.defaultAccentHue % 360) + 360) % 360);
		db.run("UPDATE settings SET default_accent_hue = ? WHERE id = 1", [hue]);
	}
	if (updates.signupEnabled !== undefined) {
		db.run("UPDATE settings SET signup_enabled = ? WHERE id = 1", [updates.signupEnabled ? 1 : 0]);
	}
	if (updates.backgroundImage !== undefined) {
		db.run("UPDATE settings SET background_image = ? WHERE id = 1", [updates.backgroundImage]);
	}
	if (updates.serverStorageLimitMb !== undefined) {
		db.run("UPDATE settings SET server_storage_limit_mb = ? WHERE id = 1", [updates.serverStorageLimitMb]);
	}
	if (updates.maxImportSizeMb !== undefined) {
		db.run("UPDATE settings SET max_import_size_mb = ? WHERE id = 1", [updates.maxImportSizeMb]);
	}
	if (updates.transcriptionEnabled !== undefined) {
		db.run("UPDATE settings SET transcription_enabled = ? WHERE id = 1", [updates.transcriptionEnabled ? 1 : 0]);
	}
	if (updates.transcriptionModel !== undefined && TRANSCRIPTION_MODELS.includes(updates.transcriptionModel)) {
		db.run("UPDATE settings SET transcription_model = ? WHERE id = 1", [updates.transcriptionModel]);
	}
	if (updates.requireStrongPasswords !== undefined) {
		db.run("UPDATE settings SET require_strong_passwords = ? WHERE id = 1", [
			updates.requireStrongPasswords ? 1 : 0
		]);
	}
	if (updates.requireEmail !== undefined) {
		db.run("UPDATE settings SET require_email = ? WHERE id = 1", [updates.requireEmail ? 1 : 0]);
	}
	return getSettings();
}
