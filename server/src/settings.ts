import type { Settings } from "@recoral/shared";
import { db } from "./db";

interface SettingsRow {
	id: number;
	default_accent_hue: number | null;
	signup_enabled: number;
	background_image: string | null;
	server_storage_limit_mb: number | null;
}

function toSettings(row: SettingsRow): Settings {
	return {
		defaultAccentHue: row.default_accent_hue,
		signupEnabled: row.signup_enabled === 1,
		backgroundImage: row.background_image,
		serverStorageLimitMb: row.server_storage_limit_mb
	};
}

export function getSettings(): Settings {
	const row = db.query<SettingsRow, []>("SELECT * FROM settings WHERE id = 1").get();
	return row
		? toSettings(row)
		: { defaultAccentHue: null, signupEnabled: true, backgroundImage: null, serverStorageLimitMb: 204800 };
}

export function updateSettings(updates: {
	defaultAccentHue?: number | null;
	signupEnabled?: boolean;
	backgroundImage?: string | null;
	serverStorageLimitMb?: number | null;
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
	return getSettings();
}
