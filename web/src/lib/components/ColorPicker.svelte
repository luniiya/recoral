<script lang="ts">
	import { ACCENT_PRESETS } from '$lib/accent';

	interface Props {
		value: number;
		onselect: (hue: number) => void;
	}

	let { value, onselect }: Props = $props();

	let isPreset = $derived(ACCENT_PRESETS.some((p) => p.hue === value));
	let open = $state(false);
</script>

<div class="grid grid-cols-4 gap-3 sm:grid-cols-9">
	{#each ACCENT_PRESETS as preset (preset.hue)}
		<button
			type="button"
			title={preset.name}
			aria-label={preset.name}
			aria-pressed={value === preset.hue}
			class="size-9 rounded-full transition dark:ring-offset-neutral-900"
			class:ring-2={value === preset.hue}
			class:ring-offset-2={value === preset.hue}
			class:ring-gray-400={value === preset.hue}
			style:background-color={`oklch(69% 0.17 ${preset.hue})`}
			onclick={() => onselect(preset.hue)}
		></button>
	{/each}

	<div class="relative">
		<button
			type="button"
			title="Custom color"
			aria-label="Custom color"
			aria-pressed={!isPreset}
			class="flex size-9 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition dark:bg-white/10 dark:text-gray-400 dark:ring-offset-neutral-900"
			class:ring-2={!isPreset}
			class:ring-offset-2={!isPreset}
			class:ring-gray-400={!isPreset}
			onclick={() => (open = !open)}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
				/>
			</svg>
		</button>

		{#if open}
			<button class="fixed inset-0 z-10 cursor-default" aria-label="Close custom color" onclick={() => (open = false)}
			></button>

			<div class="card absolute top-full right-0 z-20 mt-2 w-56 p-4">
				<label class="flex items-center gap-3">
					<span
						class="hue-slider-wrap size-8 shrink-0 rounded-full ring-2 ring-gray-400 ring-offset-2 dark:ring-offset-neutral-900"
						style:background-color={`oklch(69% 0.17 ${value})`}
					></span>
					<input
						class="hue-slider min-w-0 flex-1"
						type="range"
						min="0"
						max="359"
						step="1"
						{value}
						oninput={(e) => onselect(Number(e.currentTarget.value))}
						aria-label="Custom accent color"
					/>
				</label>
			</div>
		{/if}
	</div>
</div>

<style>
	.hue-slider {
		appearance: none;
		height: 0.5rem;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			oklch(69% 0.17 0),
			oklch(69% 0.17 60),
			oklch(69% 0.17 120),
			oklch(69% 0.17 180),
			oklch(69% 0.17 240),
			oklch(69% 0.17 300),
			oklch(69% 0.17 359)
		);
	}

	.hue-slider::-webkit-slider-thumb {
		appearance: none;
		size: 1.1rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		background: white;
		border: 2px solid rgba(0, 0, 0, 0.2);
		cursor: pointer;
	}

	.hue-slider::-moz-range-thumb {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		background: white;
		border: 2px solid rgba(0, 0, 0, 0.2);
		cursor: pointer;
	}
</style>
