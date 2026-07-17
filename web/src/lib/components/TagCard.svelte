<script lang="ts">
	import { collectTagIds, tagBreadcrumb, type TagNode } from '$lib/tagPath';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import ColorPicker from './ColorPicker.svelte';
	import Dialog from './Dialog.svelte';
	import TagChip from './TagChip.svelte';

	let pendingTrash = $state<{ id: string; label: string } | null>(null);

	function countLabel(node: TagNode) {
		const count = recordingsStore.taggedCount(collectTagIds(node));
		return `${count} recording${count === 1 ? '' : 's'}`;
	}

	interface Props {
		node: TagNode;
	}

	let { node }: Props = $props();

	let editingHeader = $state(false);
	let headerName = $state('');
	let headerHue = $state(26);
	let headerError = $state('');

	function startHeaderEdit() {
		if (!node.tag) return;
		headerName = node.tag.name;
		headerHue = node.tag.hue;
		headerError = '';
		editingHeader = true;
	}

	async function saveHeaderEdit() {
		if (!node.tag) return;
		headerError = '';
		try {
			await tagsStore.update(node.tag.id, { name: headerName, hue: headerHue });
			editingHeader = false;
		} catch (err) {
			headerError = (err as Error).message;
		}
	}

	let addingSubtag = $state(false);
	let subtagName = $state('');
	let subtagHue = $state(26);
	let subtagError = $state('');

	function startAddSubtag() {
		subtagName = '';
		subtagHue = 26;
		subtagError = '';
		addingSubtag = true;
	}

	async function saveSubtag(event: SubmitEvent) {
		event.preventDefault();
		subtagError = '';
		const leaf = subtagName.trim();
		if (!leaf) return;
		try {
			await tagsStore.create(`${node.path}/${leaf}`, subtagHue);
			addingSubtag = false;
		} catch (err) {
			subtagError = (err as Error).message;
		}
	}

	let editingSubtagPath = $state<string | null>(null);
	let subtagEditName = $state('');
	let subtagEditHue = $state(26);
	let subtagEditError = $state('');

	function startEditSubtag(child: TagNode) {
		if (!child.tag) return;
		editingSubtagPath = child.path;
		subtagEditName = child.tag.name;
		subtagEditHue = child.tag.hue;
		subtagEditError = '';
	}

	async function saveSubtagEdit(child: TagNode) {
		if (!child.tag) return;
		subtagEditError = '';
		try {
			await tagsStore.update(child.tag.id, { name: subtagEditName, hue: subtagEditHue });
			editingSubtagPath = null;
		} catch (err) {
			subtagEditError = (err as Error).message;
		}
	}
</script>

<div class="card p-4">
	<div class="flex items-center justify-between gap-3">
		{#if node.tag}
			{@const tag = node.tag}
			<div class="relative inline-block min-w-0">
				<TagChip {tag} label={node.label} onclick={startHeaderEdit} />

				{#if editingHeader}
					<button
						class="fixed inset-0 z-10 cursor-default"
						aria-label="Close edit"
						onclick={() => (editingHeader = false)}
					></button>

					<div class="card absolute top-full left-0 z-20 mt-2 w-64 p-4">
						<label class="mb-3 flex flex-col gap-1.5">
							<span class="form-label">Name</span>
							<input class="form-input" bind:value={headerName} />
						</label>
						<div class="mb-3 flex flex-col gap-1.5">
							<span class="form-label">Color</span>
							<ColorPicker value={headerHue} onselect={(h) => (headerHue = h)} />
						</div>
						{#if headerError}
							<p class="mb-2 text-sm text-red-600 dark:text-red-400">{headerError}</p>
						{/if}
						<button
							class="w-full rounded-full bg-accent-500 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
							onclick={saveHeaderEdit}
						>
							Save
						</button>
					</div>
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-2">
				<span class="text-xs text-gray-400">{countLabel(node)}</span>
				<button
					class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/10"
					aria-label={`Move ${node.label} to bin`}
					title="Move to bin"
					onclick={() => (pendingTrash = { id: tag.id, label: tagBreadcrumb(tag.name) })}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7"
					/>
				</svg>
			</button>
			</div>
		{:else}
			<span class="py-1 text-sm font-semibold text-gray-400 dark:text-gray-500">{node.label}</span>
		{/if}
	</div>

	<div class="mt-4 border-t border-gray-200 pt-3 dark:border-white/10">
		<p class="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">Subtags</p>

		<div class="flex flex-wrap items-center gap-1.5">
			{#each node.children as child (child.path)}
				{#if child.tag}
					{@const childTag = child.tag}
					<div class="relative inline-block">
						<TagChip
							tag={childTag}
							label={child.label}
							parentHue={node.tag?.hue ?? null}
							onclick={() => startEditSubtag(child)}
							ondelete={() => (pendingTrash = { id: childTag.id, label: tagBreadcrumb(childTag.name) })}
						/>

						{#if editingSubtagPath === child.path}
							<button
								class="fixed inset-0 z-10 cursor-default"
								aria-label="Close edit"
								onclick={() => (editingSubtagPath = null)}
							></button>

							<div class="card absolute top-full left-0 z-20 mt-2 w-64 p-4">
								<label class="mb-3 flex flex-col gap-1.5">
									<span class="form-label">Name</span>
									<input class="form-input" bind:value={subtagEditName} />
								</label>
								<div class="mb-3 flex flex-col gap-1.5">
									<span class="form-label">Color</span>
									<ColorPicker value={subtagEditHue} onselect={(h) => (subtagEditHue = h)} />
								</div>
								{#if subtagEditError}
									<p class="mb-2 text-sm text-red-600 dark:text-red-400">{subtagEditError}</p>
								{/if}
								<button
									class="w-full rounded-full bg-accent-500 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
									onclick={() => saveSubtagEdit(child)}
								>
									Save
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}

			<div class="relative inline-block">
				<button
					class="flex items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-xs font-medium text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-400 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={startAddSubtag}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
						<path stroke-linecap="round" d="M12 5v14M5 12h14" />
					</svg>
					Add subtag
				</button>

				{#if addingSubtag}
					<button
						class="fixed inset-0 z-10 cursor-default"
						aria-label="Close add subtag"
						onclick={() => (addingSubtag = false)}
					></button>

					<div class="card absolute top-full left-0 z-20 mt-2 w-64 p-4">
						<form onsubmit={saveSubtag} class="contents">
							<label class="mb-3 flex flex-col gap-1.5">
								<span class="form-label">Name</span>
								<input class="form-input" bind:value={subtagName} placeholder="e.g. certainvoice" required />
							</label>
							<div class="mb-3 flex flex-col gap-1.5">
								<span class="form-label">Color</span>
								<ColorPicker value={subtagHue} onselect={(h) => (subtagHue = h)} />
							</div>
							{#if subtagError}
								<p class="mb-2 text-sm text-red-600 dark:text-red-400">{subtagError}</p>
							{/if}
							<button
								type="submit"
								class="w-full rounded-full bg-accent-500 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
							>
								Add
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#if pendingTrash}
	<Dialog onclose={() => (pendingTrash = null)}>
		<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
			Move <span class="font-semibold">{pendingTrash.label}</span> to the bin?
		</p>
		<div class="flex gap-2">
			<button
				class="flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
				onclick={() => (pendingTrash = null)}
			>
				Cancel
			</button>
			<button
				class="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
				onclick={() => {
					if (pendingTrash) tagsStore.trash(pendingTrash.id);
					pendingTrash = null;
				}}
			>
				Move to bin
			</button>
		</div>
	</Dialog>
{/if}
