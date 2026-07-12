<script lang="ts">
	import type { Tag } from '@recoral/shared';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { tagsStore } from '$lib/tags.svelte';

	let name = $state('');
	let hue = $state(26);
	let error = $state('');

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editHue = $state(26);
	let editError = $state('');

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

	function startEdit(tag: Tag) {
		editingId = tag.id;
		editName = tag.name;
		editHue = tag.hue;
		editError = '';
	}

	async function saveEdit(id: string) {
		editError = '';
		try {
			await tagsStore.update(id, { name: editName, hue: editHue });
			editingId = null;
		} catch (err) {
			editError = (err as Error).message;
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
			<li class="relative">
				<button
					class="flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3 text-sm font-medium text-white"
					style:background-color={`oklch(60% 0.17 ${tag.hue})`}
					onclick={() => startEdit(tag)}
				>
					{tag.name}
					<span
						role="button"
						tabindex="0"
						class="flex size-4 items-center justify-center rounded-full hover:bg-white/20"
						aria-label={`Delete ${tag.name}`}
						onclick={(e) => {
							e.stopPropagation();
							tagsStore.remove(tag.id);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.stopPropagation();
								tagsStore.remove(tag.id);
							}
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="size-2.5">
							<path stroke-linecap="round" d="M5 5l14 14M19 5 5 19" />
						</svg>
					</span>
				</button>

				{#if editingId === tag.id}
					<button
						class="fixed inset-0 z-10 cursor-default"
						aria-label="Close edit"
						onclick={() => (editingId = null)}
					></button>

					<div class="card absolute top-full left-0 z-20 mt-2 w-64 p-4">
						<label class="mb-3 flex flex-col gap-1.5">
							<span class="form-label">Name</span>
							<input class="form-input" bind:value={editName} />
						</label>
						<div class="mb-3 flex flex-col gap-1.5">
							<span class="form-label">Color</span>
							<ColorPicker value={editHue} onselect={(h) => (editHue = h)} />
						</div>
						{#if editError}
							<p class="mb-2 text-sm text-red-600 dark:text-red-400">{editError}</p>
						{/if}
						<button
							class="w-full rounded-full bg-accent-500 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
							onclick={() => saveEdit(tag.id)}
						>
							Save
						</button>
					</div>
				{/if}
			</li>
		{:else}
			<li class="card w-full border-dashed p-8 text-center text-sm text-gray-400">No tags yet</li>
		{/each}
	</ul>
{/if}
