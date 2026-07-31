// A hard `.pause()`/`.play()` (or an <audio> element getting torn down
// mid-playback) can produce an audible click/pop as the underlying hardware
// output stream starts or stops mid-waveform, confirmed happening on Android
// on essentially every pause/resume and occasionally right at a recording's
// natural end. Ramping volume to/from 0 over a few dozen milliseconds around
// the actual play()/pause() call masks that discontinuity, the same
// "declick" technique real audio software uses. This uses the plain
// HTMLMediaElement's own `volume` rather than a full Web Audio API
// GainNode graph, since nothing else in this app needs that graph and a
// ramp this short doesn't need sample-accurate scheduling to be inaudible.
export const AUDIO_FADE_MS = 30;

function rampVolume(audioEl: HTMLAudioElement, from: number, to: number, durationMs: number): Promise<void> {
	return new Promise((resolve) => {
		if (durationMs <= 0 || from === to) {
			audioEl.volume = to;
			resolve();
			return;
		}
		const start = performance.now();
		function step(now: number) {
			const t = Math.min(1, (now - start) / durationMs);
			audioEl.volume = from + (to - from) * t;
			if (t < 1) requestAnimationFrame(step);
			else resolve();
		}
		requestAnimationFrame(step);
	});
}

export async function fadeOutAndPause(audioEl: HTMLAudioElement): Promise<void> {
	if (audioEl.paused) return;
	const target = audioEl.volume;
	await rampVolume(audioEl, target, 0, AUDIO_FADE_MS);
	audioEl.pause();
	audioEl.volume = target;
}

export async function fadeInAndPlay(audioEl: HTMLAudioElement): Promise<void> {
	const target = audioEl.volume;
	audioEl.volume = 0;
	try {
		await audioEl.play();
	} catch {
		// Autoplay/interruption rejection: restore volume so a later real
		// play() isn't left starting from 0.
		audioEl.volume = target;
		return;
	}
	await rampVolume(audioEl, 0, target, AUDIO_FADE_MS);
}
