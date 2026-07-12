<script lang="ts">
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { tagsStore } from '$lib/tags.svelte';

	let name = $state('');
	let hue = $state(26);
	let error = $state('');

	async function createTag(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			await tagsStore.create(name, hue);
			name = '';
		} catch (err) {
			error = (err as Error).message;
		}
	}
</script>

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Tags</h1>

<form onsubmit={createTag} class="card mb-8 flex flex-col gap-4 p-5">
	<label class="flex flex-col gap-1.5">
		<span class="form-label">Name</span>
		<input class="form-input" bind:value={name} placeholder="e.g. Ideas" required />
	</label>

	<div class="flex flex-col gap-1.5">
		<span class="form-label">Color</span>
		<ColorPicker value={hue} onselect={(h) => (hue = h)} />
	</div>

	{#if error}
		<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
	{/if}

	<button
		type="submit"
		class="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
	>
		Add tag
	</button>
</form>

{#if tagsStore.loaded}
	<ul class="flex flex-wrap gap-2">
		{#each tagsStore.list as tag (tag.id)}
			<li
				class="flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3 text-sm font-medium text-white"
				style:background-color={`oklch(60% 0.17 ${tag.hue})`}
			>
				{tag.name}
				<button
					class="flex size-4 items-center justify-center rounded-full hover:bg-white/20"
					aria-label={`Delete ${tag.name}`}
					onclick={() => tagsStore.remove(tag.id)}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-2.5">
						<path stroke-linecap="round" d="M5 5l14 14M19 5 5 19" />
					</svg>
				</button>
			</li>
		{:else}
			<li class="card w-full border-dashed p-8 text-center text-sm text-gray-400">No tags yet</li>
		{/each}
	</ul>
{/if}
