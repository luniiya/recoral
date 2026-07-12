<script lang="ts">
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import TagCard from '$lib/components/TagCard.svelte';
	import { buildTagTree } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';

	let adding = $state(false);
	let name = $state('');
	let hue = $state(26);
	let error = $state('');

	let tree = $derived(buildTagTree(tagsStore.list));

	function startAdd() {
		name = '';
		hue = 26;
		error = '';
		adding = true;
	}

	async function createTag(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			await tagsStore.create(name, hue);
			adding = false;
		} catch (err) {
			error = (err as Error).message;
		}
	}
</script>

<svelte:head>
	<title>recoral - Tags</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 py-10">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Tags</h1>

		<div class="relative inline-block">
			<button
				class="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
				onclick={startAdd}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="size-4">
					<path stroke-linecap="round" d="M12 5v14M5 12h14" />
				</svg>
				Add tag
			</button>

			{#if adding}
				<button class="fixed inset-0 z-10 cursor-default" aria-label="Close add tag" onclick={() => (adding = false)}
				></button>

				<div class="card absolute top-full right-0 z-20 mt-2 w-72 p-5">
					<form onsubmit={createTag} class="flex flex-col gap-4">
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
							class="rounded-full bg-accent-500 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
						>
							Add tag
						</button>
					</form>
				</div>
			{/if}
		</div>
	</div>

	{#if tagsStore.loaded}
		{#if tree.length > 0}
			<div class="flex flex-col gap-3">
				{#each tree as node (node.path)}
					<TagCard {node} />
				{/each}
			</div>
		{:else}
			<div class="card border-dashed p-8 text-center text-sm text-gray-400">No tags yet</div>
		{/if}
	{/if}
</div>
