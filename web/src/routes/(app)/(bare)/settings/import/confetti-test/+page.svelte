<script lang="ts">
	// TEMP: throwaway page to preview the confetti effect without running a
	// real import. Delete this route once you're happy with it.
	import Confetti from '$lib/components/Confetti.svelte';

	let key = $state(0);
</script>

<div class="flex h-full flex-col items-center justify-center gap-4">
	{#key key}
		<Confetti />
	{/key}
	<button
		class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
		onclick={() => key++}
	>
		Trigger confetti again
	</button>
</div>
