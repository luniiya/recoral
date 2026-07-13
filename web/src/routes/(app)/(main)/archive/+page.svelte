<script lang="ts">
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';

	let selectedId = $state<string | null>(null);

	let selectedRecording = $derived(recordingsStore.archived.find((r) => r.id === selectedId) ?? null);
</script>

<svelte:head>
	<title>recoral - Archive</title>
</svelte:head>

<div class="flex h-full">
	<div
		class="h-full overflow-y-auto transition-[width] duration-300 {selectedRecording
			? 'w-[26rem] shrink-0'
			: 'w-full'}"
	>
		<div class="mx-auto max-w-xl px-6 py-10">
			<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

			<ul class="flex flex-col gap-3">
				{#each recordingsStore.archived as recording (recording.id)}
					<li>
						<RecordingCard {recording} selected={selectedId === recording.id} onselect={() => (selectedId = recording.id)} />
					</li>
				{:else}
					<li class="card border-dashed p-8 text-center text-sm text-gray-400">Nothing archived yet</li>
				{/each}
			</ul>
		</div>
	</div>

	{#if selectedRecording}
		<div class="min-w-0 flex-1 border-l border-gray-200 dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
