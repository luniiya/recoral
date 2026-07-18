<script lang="ts">
	import { goto } from '$app/navigation';
	import { applyAccentHue, cacheAccentHue } from '$lib/accent';
	import LogoWordmark from '$lib/components/LogoWordmark.svelte';
	import { onboarding } from '$lib/onboarding.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { systemAccentStore } from '$lib/systemAccent.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { onMount } from 'svelte';

	let serverUrl = $state('');
	let connecting = $state(false);
	let error = $state('');

	function normalizeUrl(raw: string): string {
		const trimmed = raw.trim().replace(/\/+$/, '');
		if (!trimmed) return '';
		// Bare host:port (no scheme) is almost always a local/self-hosted server
		// reached directly without a reverse proxy in front of it, so plain http
		// is the sane default, not https.
		return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
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
			const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) });
			if (!res.ok) throw new Error();
			onboarding.completeWithServer(url);
			goto('/login');
		} catch (err) {
			console.error('Failed to reach server:', err);
			error = "Couldn't reach that server. Check the address and try again.";
		} finally {
			connecting = false;
		}
	}

	function goOffline() {
		onboarding.completeOffline();
		goto('/setup/offline');
	}

	// No account/server exists yet to have a saved accent, so this screen
	// (and /setup/offline) follows the phone's own Material You color
	// instead, same priority the logged-in app already gives system color
	// over a picked one. Once a server's picked, the login page takes over
	// and applies that server's own accent config instead (its admin-pinned
	// default, or a random one if the admin never pinned one).
	onMount(() => {
		if (isNativePlatform()) {
			void systemAccentStore.init().then(() => {
				if (!systemAccentStore.enabled || !systemAccentStore.available) return;
				const hue = systemAccentStore.effectiveHue(0);
				applyAccentHue(hue);
				cacheAccentHue(hue);
			});
		}
	});

	// This screen only ever appears in the native app (before a server/account
	// exists to have a saved theme preference), so it always follows system.
	onMount(() => {
		themeStore.previewSystem();
		return () => themeStore.restore();
	});
</script>

<svelte:head>
	<title>Set up recoral</title>
</svelte:head>

<section class="relative flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
	<div class="card relative z-10 w-full max-w-sm p-8">
		<div class="mb-8 flex flex-col items-center gap-2">
			<LogoWordmark size="size-12" textSize="text-2xl" colored />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Welcome</h1>
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
