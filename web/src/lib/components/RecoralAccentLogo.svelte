<script lang="ts">
	// The monochrome silhouette, tinted to the current accent color (see
	// app.css's .logo-mark, a masked image recolored via --accent-500). Use
	// this wherever a deliberate accent is actually in play, either the
	// logged-in user's own saved hue or an admin-pinned default. Never use it
	// where the accent might be an arbitrary/random pick, e.g. the login
	// screen before a fixed accent exists, that's what RecoralColoredLogo is
	// for instead.
	interface Props {
		size?: string;
	}

	let { size = 'size-7' }: Props = $props();
</script>

<span class="logo-mark {size} shrink-0" role="img" aria-label="recoral"></span>
