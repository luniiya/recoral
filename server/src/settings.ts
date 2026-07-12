import type { Settings } from "@recoral/shared";
import { db } from "./db";

interface SettingsRow {
	id: number;
	default_accent_hue: number | null;
	signup_enabled: number;
}

function toSettings(row: SettingsRow): Settings {
	return { defaultAccentHue: row.default_accent_hue, signupEnabled: row.signup_enabled === 1 };
}

export function getSettings(): Settings {
	const row = db.query<SettingsRow, []>("SELECT * FROM settings WHERE id = 1").get();
	return row ? toSettings(row) : { defaultAccentHue: null, signupEnabled: true };
}

export function updateSettings(updates: { defaultAccentHue?: number | null; signupEnabled?: boolean }): Settings {
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
	return getSettings();
}
