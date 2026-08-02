// Logarithmic volume taper: equal slider steps ≈ equal dB steps, matching how
// loudness perception actually works, instead of the classic "YouTube slider"
// mistake of raw linear gain (dead for most of the slider's travel, then a
// hard jump near the top). Shared by AudioPlayer's own per-instance slider and
// FloatingVolumeControl's page-level one, so both feel identical.
const VOLUME_RANGE_DB = 50;

export function sliderToGain(t: number): number {
	if (t <= 0) return 0;
	return Math.pow(10, ((t - 1) * VOLUME_RANGE_DB) / 20);
}
