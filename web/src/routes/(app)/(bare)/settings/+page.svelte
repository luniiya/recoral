<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import { readAsDataUrl } from '$lib/file';
	import { systemAccentStore } from '$lib/systemAccent.svelte';
	import { themeStore, type ThemePreference } from '$lib/theme.svelte';
	import { wavySeekStore } from '$lib/wavySeek.svelte';

	const themeOptions: { value: ThemePreference; label: string }[] = [
		{ value: 'system', label: 'Auto' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	let saving = $state(false);
	let error = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	async function onAvatarSelected(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		error = '';
		saving = true;
		try {
			const dataUrl = await readAsDataUrl(file);
			await auth.updateAccount({ avatar: dataUrl });
		} catch (err) {
			error = (err as Error).message;
		} finally {
			saving = false;
		}
	}

	async function onHueSelected(hue: number) {
		error = '';
		saving = true;
		try {
			await auth.updateAccount({ accentHue: hue });
		} catch (err) {
			error = (err as Error).message;
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>recoral - Settings</title>
</svelte:head>

<div class="mb-6 flex items-center gap-3">
	<BackButton mobileHref="/account" desktopHref="/" label="Back" />
	<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Account settings</h1>
</div>

{#if auth.user}
	<div class="card mb-6 flex flex-col items-center gap-4 p-8">
		<div class="relative">
			<Avatar name={auth.user.username} avatar={auth.user.avatar} size="size-20" />
			<button
				class="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-white text-gray-600 shadow ring-1 ring-gray-200 transition hover:text-accent-600 dark:bg-neutral-800 dark:text-gray-300 dark:ring-white/10"
				onclick={() => fileInput?.click()}
				aria-label="Change profile picture"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
					/>
				</svg>
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				class="hidden"
				onchange={onAvatarSelected}
			/>
		</div>
		<span class="text-sm font-medium text-gray-900 dark:text-gray-100">{auth.user.username}</span>
		{#if auth.user.email}
			<span class="-mt-3 text-sm text-gray-500 dark:text-gray-400">{auth.user.email}</span>
		{/if}
	</div>

	<div class="card mb-6 p-6">
		<h2 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Accent color</h2>
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Applies across the whole app, on every device.</p>

		{#if systemAccentStore.available}
			<div class="mb-5 flex items-center justify-between gap-4 border-b border-gray-100 pb-5 dark:border-white/10">
				<div>
					<p class="text-sm text-gray-900 dark:text-gray-100">Use device color</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Match this phone's own system accent color, on this device only.
					</p>
				</div>
				<Toggle checked={systemAccentStore.enabled} onchange={(checked) => systemAccentStore.set(checked)} />
			</div>
			{#if systemAccentStore.enabled}
				<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
					Your own color below applies once "Use device color" is off.
				</p>
			{/if}
		{/if}

		<ColorPicker value={auth.user.accentHue} onselect={onHueSelected} />
	</div>

	<div class="card mb-6 p-6">
		<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>

		<div class="mb-5 flex items-center justify-between gap-4">
			<p class="text-sm text-gray-900 dark:text-gray-100">Theme</p>
			<div class="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-white/5">
				{#each themeOptions as option (option.value)}
					<button
						class="rounded-full px-3.5 py-1.5 text-sm font-medium transition
							{themeStore.preference === option.value
							? 'bg-accent-500 text-white'
							: 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/10'}"
						onclick={() => themeStore.set(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-white/10">
			<div>
				<p class="text-sm text-gray-900 dark:text-gray-100">Wavy playback indicator</p>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Wobble the seek bar's played portion while audio is playing.
				</p>
			</div>
			<Toggle checked={wavySeekStore.enabled} onchange={(checked) => wavySeekStore.set(checked)} />
		</div>
	</div>

	<div class="card p-6">
		<h2 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Import / Export</h2>
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Move recordings in or out of recoral.</p>
		<div class="flex gap-2">
			<a
				href="/settings/import"
				class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
			>
				Import
			</a>
			<a
				href="/settings/export"
				class="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
			>
				Export
			</a>
		</div>
	</div>

	{#if error}
		<p class="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
	{/if}
{/if}
