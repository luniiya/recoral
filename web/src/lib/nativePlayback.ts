import { Capacitor, registerPlugin } from '@capacitor/core';

// Bridges to PlaybackService (see mobile/android/.../playback/), the actual
// Android system media notification. Confirmed via dumpsys notification that
// the Web Media Session API alone (mediaSession.ts) never creates one inside
// a bare embedded WebView, that integration belongs to the Chrome app itself,
// not something any WebView host gets automatically. iOS isn't scaffolded at
// all yet (see CLAUDE.md), so this is Android-only for now.
export interface PlaybackPlugin {
	// The full initial state, not just a title: the very first notification is
	// built from this alone (see PlaybackService.start()), so leaving
	// playing/position out here meant it always opened showing "Paused" even
	// mid-playback.
	start(options: { title: string; playing: boolean; position: number; duration: number; color: string }): Promise<void>;
	update(options: {
		title?: string;
		playing: boolean;
		position: number;
		duration: number;
		color: string;
	}): Promise<void>;
	stop(): Promise<void>;
	addListener(
		eventName: 'playbackAction',
		listenerFunc: (data: {
			action: 'play' | 'pause' | 'seekBackward' | 'seekForward' | 'seekTo';
			// Seconds, only present for 'seekTo' (a drag on the notification's
			// own progress bar to an absolute position).
			position?: number;
		}) => void
	): Promise<{ remove: () => void }>;
}

export const Playback = registerPlugin<PlaybackPlugin>('Playback');

export function isSupported(): boolean {
	return Capacitor.getPlatform() === 'android';
}
