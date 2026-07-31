// Whether the quick-scroll Scrubber is actively in use (dragging, hovered, or
// mid-scroll), on any input device. FloatingVolumeControl reads this to get
// out of the way, they sit in the same bottom-right corner and fighting for
// attention there looks bad on both mobile drag and desktop mouse hover.
let active = $state(false);

export const scrubbingStore = {
	get active() {
		return active;
	},
	set(value: boolean) {
		active = value;
	}
};
