<script lang="ts">
	interface Props {
		backgroundImage: string | null;
		randomAccent: boolean;
		accentHue: number;
	}

	let { backgroundImage, randomAccent, accentHue }: Props = $props();
</script>

<div class="relative h-56 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-neutral-800">
	{#if backgroundImage}
		<img src={backgroundImage} alt="" class="absolute inset-0 size-full object-cover" />
		<div class="absolute inset-0 bg-black/60"></div>
	{/if}

	<div class="absolute inset-0 flex items-center justify-center">
		<div class="flex w-36 flex-col items-center gap-2 rounded-xl bg-white/95 p-4 dark:bg-neutral-900/95">
			<div class="size-4.5 rounded-full {randomAccent ? 'preview-rainbow' : ''}" style={randomAccent ? '' : `background: oklch(69% 0.17 ${accentHue})`}></div>
			<div class="h-2 w-24 rounded-full bg-gray-200 dark:bg-white/10"></div>
			<div class="h-2 w-24 rounded-full bg-gray-200 dark:bg-white/10"></div>
			<div
				class="mt-1.5 h-3.5 w-28 rounded-full {randomAccent ? 'preview-rainbow' : ''}"
				style={randomAccent ? '' : `background: oklch(69% 0.17 ${accentHue})`}
			></div>
		</div>
	</div>
</div>

<style>
	/* Random accent picks a fresh hue per visit, there's no single color to show,
	   so a moving rainbow stands in for "this changes every time" instead of
	   freezing on one arbitrary hue in the preview. */
	.preview-rainbow {
		background: linear-gradient(135deg, #ff0000, #ff9900, #ffee00, #33ff00, #00e5ff, #3300ff, #cc00ff, #ff0000);
		background-size: 300% 300%;
		animation: preview-rainbow-shift 4s linear infinite;
	}

	@keyframes preview-rainbow-shift {
		0% {
			background-position: 0% 0%;
		}
		100% {
			background-position: 100% 100%;
		}
	}
</style>
