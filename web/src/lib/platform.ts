import { Capacitor } from '@capacitor/core';

// True only inside the Capacitor-wrapped mobile shell, always false in a
// regular browser tab (desktop webUI), Capacitor itself handles the check
// safely in both contexts.
export function isNativePlatform(): boolean {
	return Capacitor.isNativePlatform();
}
