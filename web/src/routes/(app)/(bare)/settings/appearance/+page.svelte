<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
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
	<title>recoral - Appearance</title>
</svelte:head>

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h1>

{#if auth.user}
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

	<div class="card p-6">
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

	{#if error}
		<p class="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
	{/if}
{/if}
