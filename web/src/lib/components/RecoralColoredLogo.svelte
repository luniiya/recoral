<script lang="ts">
	// The real multi-tone brand mark (design/logo colored transparent bg.png),
	// fixed colors, never recolored by the accent system. Use this wherever
	// tinting to the current accent would look wrong, e.g. the login/setup
	// screens before a deliberate accent (a saved user hue, an admin-pinned
	// default, or the phone's own system color) is actually in play, not
	// RecoralAccentLogo's arbitrary/random fallback case.
	interface Props {
		size?: string;
	}

	let { size = 'size-7' }: Props = $props();
</script>

<img src="/logo-colored.png" alt="recoral" class="{size} shrink-0 object-contain" />
