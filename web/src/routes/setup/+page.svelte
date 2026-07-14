<script lang="ts">
	import { goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { onboarding } from '$lib/onboarding.svelte';

	let serverUrl = $state('');
	let connecting = $state(false);
	let error = $state('');

	function normalizeUrl(raw: string): string {
		const trimmed = raw.trim().replace(/\/+$/, '');
		if (!trimmed) return '';
		return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	}

	async function connect(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		const url = normalizeUrl(serverUrl);
		if (!url) {
			error = 'Enter a server address';
			return;
		}
		connecting = true;
		try {
			const res = await fetch(`${url}/api/health`);
			if (!res.ok) throw new Error();
			onboarding.completeWithServer(url);
			goto('/login');
		} catch {
			error = "Couldn't reach that server. Check the address and try again.";
		} finally {
			connecting = false;
		}
	}

	function goOffline() {
		onboarding.completeOffline();
		goto('/setup/offline');
	}
</script>

<svelte:head>
	<title>Set up recoral</title>
</svelte:head>

<section class="relative flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
	<div class="absolute top-4 right-4 z-10">
		<ThemeToggle />
	</div>

	<div class="card relative z-10 w-full max-w-sm p-8">
		<div class="mb-8 flex flex-col items-center gap-2">
			<img src="/logo.png" alt="recoral" class="size-12 rounded-full object-cover" />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Welcome to recoral</h1>
			<p class="text-center text-sm text-gray-500 dark:text-gray-400">
				Connect to your recoral server, or record fully offline with no account, ever.
			</p>
		</div>

		<form onsubmit={connect} class="flex flex-col gap-4">
			{#if error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
					{error}
				</p>
			{/if}

			<label class="flex flex-col gap-1.5">
				<span class="form-label">Server address</span>
				<input
					class="form-input"
					bind:value={serverUrl}
					placeholder="recoral.example.com"
					autocapitalize="off"
					autocorrect="off"
					required
				/>
			</label>

			<button
				type="submit"
				disabled={connecting}
				class="mt-2 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
			>
				{connecting ? 'Connecting…' : 'Connect'}
			</button>
		</form>

		<div class="my-6 flex items-center gap-3">
			<div class="h-px flex-1 bg-gray-200 dark:bg-white/10"></div>
			<span class="text-xs text-gray-400">or</span>
			<div class="h-px flex-1 bg-gray-200 dark:bg-white/10"></div>
		</div>

		<button
			type="button"
			class="w-full rounded-full px-4 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
			onclick={goOffline}
		>
			Go offline
		</button>
	</div>
</section>
