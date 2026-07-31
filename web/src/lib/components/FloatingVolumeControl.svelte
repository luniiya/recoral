<script lang="ts">
	import { scrubbingStore } from '$lib/scrubbing.svelte';
	import { sharedVolume } from '$lib/sharedVolume.svelte';
	import { sliderToGain } from '$lib/volume';
	import { scale } from 'svelte/transition';
	import GainSlider from './GainSlider.svelte';
	import VolumeIcon from './VolumeIcon.svelte';

	interface Props {
		// Recordings/Favourites/Archive also show a mobile floating search bar
		// + record FAB at this same bottom offset (Bin doesn't), so this needs
		// extra clearance there to avoid sitting on top of it.
		raised?: boolean;
	}

	let { raised = false }: Props = $props();

	let gain = $derived(sharedVolume.muted ? 0 : sliderToGain(sharedVolume.position));

	function onInput(event: Event) {
		sharedVolume.setPosition(Number((event.currentTarget as HTMLInputElement).value) / 100);
	}
</script>

{#if !scrubbingStore.active}
	<!-- One shared volume control for pages that show many simultaneous inline
	     AudioPlayers at once (Bin), instead of a separate slider per card, see
	     sharedVolume.svelte.ts. Fixed bottom-right, thumb-reachable, out of the
	     way of the cards themselves. Hidden while the Scrubber (same corner) is
	     in use, see scrubbing.svelte.ts. -->
	<div
		class="fixed right-4 z-30 flex flex-col items-center gap-2 rounded-full border border-gray-200/70 bg-white/90 p-2.5 shadow-lg backdrop-blur-lg md:right-6 md:bottom-6 dark:border-white/10 dark:bg-black/70
			{raised
			? 'bottom-[calc(9rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]'
			: 'bottom-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]'}"
		transition:scale={{ duration: 200, start: 0.85 }}
	>
		<button
			class="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
			aria-label={sharedVolume.muted || gain === 0 ? 'Unmute' : 'Mute'}
			onclick={sharedVolume.toggleMute}
		>
			<VolumeIcon muted={sharedVolume.muted} {gain} position={sharedVolume.position} class="size-4" />
		</button>

		<div class="flex h-28 w-6 items-center justify-center py-1">
			<GainSlider
				value={sharedVolume.muted ? 0 : sharedVolume.position * 100}
				oninput={onInput}
				orientation="vertical"
			/>
		</div>
	</div>
{/if}
