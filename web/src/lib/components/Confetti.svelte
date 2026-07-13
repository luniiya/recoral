<script lang="ts">
	const PIECE_COUNT = 70;
	const COLOR_VARS = ['--accent-100', '--accent-400', '--accent-500', '--accent-600', '--accent-700'];

	interface Piece {
		id: number;
		left: number;
		duration: number;
		delay: number;
		width: number;
		height: number;
		colorVar: string;
		rotateEnd: number;
		drift: number;
	}

	// Computed once when the component mounts, not reactively, so the
	// animation doesn't restart/reshuffle on unrelated re-renders.
	const pieces: Piece[] = Array.from({ length: PIECE_COUNT }, (_, i) => ({
		id: i,
		left: Math.random() * 100,
		duration: 2.6 + Math.random() * 2.2,
		delay: Math.random() * 0.7,
		width: 6 + Math.random() * 6,
		height: 10 + Math.random() * 8,
		colorVar: COLOR_VARS[Math.floor(Math.random() * COLOR_VARS.length)],
		rotateEnd: 360 + Math.random() * 360,
		drift: (Math.random() - 0.5) * 120
	}));

	// Unmount once the last piece has definitely finished falling, rather
	// than leaving 70 invisible-but-present nodes sitting off-screen forever.
	let visible = $state(true);
	setTimeout(() => (visible = false), 5500);
</script>

{#if visible}
	<div class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
		{#each pieces as piece (piece.id)}
			<span
				class="confetti-piece absolute rounded-sm"
				style:left="{piece.left}%"
				style:width="{piece.width}px"
				style:height="{piece.height}px"
				style:background="var({piece.colorVar})"
				style:animation-duration="{piece.duration}s"
				style:animation-delay="{piece.delay}s"
				style:--drift="{piece.drift}px"
				style:--rotate-end="{piece.rotateEnd}deg"
			></span>
		{/each}
	</div>
{/if}

<style>
	.confetti-piece {
		top: -5%;
		animation-name: confetti-fall;
		animation-timing-function: cubic-bezier(0.35, 0, 0.65, 1);
		animation-fill-mode: forwards;
	}

	@keyframes confetti-fall {
		0% {
			transform: translate(0, 0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translate(var(--drift), 115vh) rotate(var(--rotate-end));
			opacity: 0.85;
		}
	}
</style>
