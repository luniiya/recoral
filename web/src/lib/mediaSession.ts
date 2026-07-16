// Thin wrapper around the browser's Media Session API. Feature-detected
// everywhere since it's unsupported in some browsers and Capacitor's Android
// WebView is Chromium-based, so setting this surfaces both a desktop OS media
// widget (title, play/pause/skip) and an Android system media notification
// while a recording is playing, no native plugin needed for either.
export interface MediaSessionHandlers {
	play: () => void;
	pause: () => void;
	seekBackward: () => void;
	seekForward: () => void;
}

function supported() {
	return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function setMediaSessionMetadata(title: string) {
	if (!supported()) return;
	navigator.mediaSession.metadata = new MediaMetadata({
		title,
		artist: 'recoral',
		artwork: [{ src: '/logo.png', sizes: '512x512', type: 'image/png' }]
	});
}

export function setMediaSessionHandlers(handlers: MediaSessionHandlers) {
	if (!supported()) return;
	navigator.mediaSession.setActionHandler('play', handlers.play);
	navigator.mediaSession.setActionHandler('pause', handlers.pause);
	navigator.mediaSession.setActionHandler('seekbackward', handlers.seekBackward);
	navigator.mediaSession.setActionHandler('seekforward', handlers.seekForward);
}

export function setMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
	if (!supported()) return;
	navigator.mediaSession.playbackState = state;
}

// duration/position of 0 (not yet loaded) throws inside setPositionState, and
// a stale position briefly exceeding a freshly-reset duration during a src
// swap does too, so both are worth swallowing rather than surfacing.
export function setMediaSessionPositionState(duration: number, playbackRate: number, position: number) {
	if (!supported() || !navigator.mediaSession.setPositionState) return;
	if (!Number.isFinite(duration) || duration <= 0) return;
	try {
		navigator.mediaSession.setPositionState({
			duration,
			playbackRate,
			position: Math.min(Math.max(0, position), duration)
		});
	} catch {
		// not worth surfacing, see above
	}
}

export function clearMediaSession() {
	if (!supported()) return;
	navigator.mediaSession.metadata = null;
	navigator.mediaSession.playbackState = 'none';
	for (const action of ['play', 'pause', 'seekbackward', 'seekforward'] as const) {
		try {
			navigator.mediaSession.setActionHandler(action, null);
		} catch {
			// unsupported action in this browser, nothing to clear
		}
	}
}
