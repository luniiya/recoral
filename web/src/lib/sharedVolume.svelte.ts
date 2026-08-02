// One shared volume level for every AudioPlayer instance in the app, not a
// separate memory per recording/card: changing it anywhere (a card's inline
// slider, or the floating control on pages with many simultaneous players,
// see FloatingVolumeControl.svelte) applies everywhere else too. Not
// persisted across reloads, same as the rest of the app's session-only UI
// state (search, filters, etc.), not asked for and easy to add later if it
// turns out to matter.
let position = $state(1);
let muted = $state(false);

function setPosition(value: number) {
	position = value;
	if (value > 0) muted = false;
}

function toggleMute() {
	muted = !muted;
}

export const sharedVolume = {
	get position() {
		return position;
	},
	get muted() {
		return muted;
	},
	setPosition,
	toggleMute
};
