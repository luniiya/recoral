<script lang="ts">
	import type { Settings } from '@recoral/shared';
	import { goto } from '$app/navigation';
	import { applyAccentHue, cacheAccentHue, readCachedAccentHue } from '$lib/accent';
	import { api } from '$lib/api.svelte';
	import { auth } from '$lib/auth.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { onboarding } from '$lib/onboarding.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { themeStore } from '$lib/theme.svelte';
	import { onMount } from 'svelte';

	let mode = $state<'login' | 'register'>('login');
	let identifier = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	// Mobile only: shown editable right here so there's always a way to see
	// or change which server you're talking to, not just once during setup.
	let serverUrl = $state(api.baseUrl);
	// Bootstrap from whatever app.html already painted (cached fixed color, or a
	// prior random pick) so there's nothing to correct visually once JS runs.
	let accentHue = $state(readCachedAccentHue() ?? Math.floor(Math.random() * 360));
	let signupEnabled = $state(true);
	let backgroundImage = $state<string | null>(null);
	let error = $state('');
	let submitting = $state(false);
	let needsSetup = $state(false);

	$effect(() => {
		if (auth.user) goto('/');
	});

	// Random accent while logged out unless the admin pinned a fixed one, previewed
	// live once you're picking your own at signup. The moment auth succeeds, auth.svelte
	// applies the account's own saved hue instead.
	$effect(() => {
		applyAccentHue(accentHue);
	});

	onMount(() => {
		// No per-account theme setting exists before login, so the APK's
		// login screen always follows the system theme (no manual toggle).
		if (isNativePlatform()) themeStore.previewSystem();
		return () => {
			if (isNativePlatform()) themeStore.restore();
		};
	});

	onMount(async () => {
		const [settingsRes, setupRes] = await Promise.all([
			api.fetch('/api/settings'),
			api.fetch('/api/setup-status')
		]);

		if (setupRes.ok) {
			const setup = await setupRes.json();
			needsSetup = setup.needsSetup;
		}

		if (!settingsRes.ok) return;
		const settings: Settings = await settingsRes.json();
		signupEnabled = settings.signupEnabled;
		if (settings.defaultAccentHue !== null) {
			accentHue = settings.defaultAccentHue;
			cacheAccentHue(settings.defaultAccentHue);
		} else {
			cacheAccentHue(null);
			accentHue = Math.floor(Math.random() * 360);
		}
		if (!signupEnabled) mode = 'login';
		backgroundImage = settings.backgroundImage;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		submitting = true;
		try {
			if (needsSetup || mode === 'register') await auth.register(username, password, email, accentHue);
			else await auth.login(identifier, password);
			goto('/');
		} catch (err) {
			error = (err as Error).message;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{needsSetup ? 'Set up recoral' : mode === 'login' ? 'Log in to recoral' : 'Sign up for recoral'}</title>
</svelte:head>

<section class="relative flex min-h-dvh items-center justify-center bg-white px-4 dark:bg-black">
	{#if backgroundImage}
		<div class="absolute inset-0 overflow-hidden">
			<img src={backgroundImage} alt="" class="size-full object-cover" />
			<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
		</div>
	{/if}

	{#if !isNativePlatform()}
		<div class="absolute top-4 right-4 z-10">
			<ThemeToggle />
		</div>
	{/if}

	<div class="card relative z-10 w-full max-w-sm p-8">
		<div class="mb-8 flex flex-col items-center gap-2">
			<img src="/logo.png" alt="recoral" class="size-12 rounded-full object-cover" />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
				{needsSetup
					? 'Welcome to recoral'
					: mode === 'login'
						? 'Log in to recoral'
						: 'Create your recoral account'}
			</h1>
			{#if needsSetup}
				<p class="text-center text-sm text-gray-500 dark:text-gray-400">
					This server doesn't have an account yet. Set up the first one, it'll be the admin.
				</p>
			{/if}
		</div>

		<form onsubmit={submit} class="flex flex-col gap-4">
			{#if error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
					{error}
				</p>
			{/if}

			{#if isNativePlatform()}
				<p class="text-center text-sm text-gray-400">
					Server: <span class="text-gray-600 dark:text-gray-300">{serverUrl}</span>
				</p>
			{/if}

			{#if !needsSetup && mode === 'login'}
				<label class="flex flex-col gap-1.5">
					<span class="form-label">Username or email</span>
					<input class="form-input" bind:value={identifier} required autocomplete="username" />
				</label>
			{:else}
				<label class="flex flex-col gap-1.5">
					<span class="form-label">Username</span>
					<input
						class="form-input"
						bind:value={username}
						required
						minlength="3"
						maxlength="32"
						pattern="[a-zA-Z0-9_.-]+"
						autocomplete="username"
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="form-label">Email <span class="text-gray-400">(optional)</span></span>
					<input class="form-input" type="email" bind:value={email} autocomplete="email" />
				</label>
			{/if}

			<label class="flex flex-col gap-1.5">
				<span class="form-label">Password</span>
				<input
					class="form-input"
					type="password"
					bind:value={password}
					required
					autocomplete={needsSetup || mode === 'register' ? 'new-password' : 'current-password'}
				/>
			</label>

			{#if needsSetup || mode === 'register'}
				<div class="flex flex-col gap-1.5">
					<span class="form-label">Accent color</span>
					<ColorPicker value={accentHue} onselect={(hue) => (accentHue = hue)} />
				</div>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="mt-2 rounded-full bg-accent-500 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
			>
				{needsSetup ? 'Create admin account' : mode === 'login' ? 'Log in' : 'Create account'}
			</button>
		</form>

		{#if !needsSetup && signupEnabled}
			<button
				type="button"
				class="mt-6 w-full text-center text-sm text-accent-600 hover:underline dark:text-accent-400"
				onclick={() => (mode = mode === 'login' ? 'register' : 'login')}
			>
				{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
			</button>
		{/if}

		{#if isNativePlatform()}
			<button
				type="button"
				class="mt-3 w-full text-center text-sm text-gray-400 hover:underline"
				onclick={() => {
					onboarding.reset();
					goto('/setup');
				}}
			>
				Not your server? Start over
			</button>
		{/if}
	</div>
</section>
