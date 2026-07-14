<script lang="ts">
	import { goto } from '$app/navigation';
	import { onboarding } from '$lib/onboarding.svelte';

	function connectInstead() {
		onboarding.reset();
		goto('/setup');
	}
</script>

<svelte:head>
	<title>Offline mode</title>
</svelte:head>

<section class="flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
	<div class="card w-full max-w-sm p-8 text-center">
		<div class="mb-4 flex flex-col items-center gap-2">
			<img src="/logo.png" alt="recoral" class="size-12 rounded-full object-cover" />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Offline mode isn't ready yet</h1>
		</div>
		<p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
			Fully offline recording (on-device storage, no server, no account, ever) is planned but not built yet.
			Right now recoral needs a server to record to.
		</p>
		<button
			class="w-full rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
			onclick={connectInstead}
		>
			Connect to a server instead
		</button>
	</div>
</section>
