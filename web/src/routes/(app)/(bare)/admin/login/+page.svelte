<script lang="ts">
	import type { Settings } from '@recoral/shared';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import LoginPreview from '$lib/components/LoginPreview.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import { api } from '$lib/api.svelte';
	import { readAsDataUrl } from '$lib/file';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	let settings = $state<Settings | null>(null);
	let loading = $state(true);
	let lastPickedHue = $state(26);
	let bgFileInput: HTMLInputElement | undefined = $state();
	let bgUploading = $state(false);
	let bgError = $state('');
	let previewOpen = $state(true);

	onMount(async () => {
		const res = await api.fetch('/api/settings');
		if (res.ok) settings = await res.json();
		loading = false;
	});

	async function patchSettings(updates: Partial<Settings>) {
		const res = await api.fetch('/api/admin/settings', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(updates)
		});
		if (res.ok) settings = await res.json();
	}

	async function onBackgroundSelected(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		bgError = '';
		bgUploading = true;
		try {
			const dataUrl = await readAsDataUrl(file);
			const res = await api.fetch('/api/admin/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ backgroundImage: dataUrl })
			});
			const body = await res.json();
			if (!res.ok) {
				bgError = body.error ?? 'Something went wrong';
				return;
			}
			settings = body;
		} catch {
			bgError = 'Upload failed, check your connection and try again';
		} finally {
			bgUploading = false;
			if (bgFileInput) bgFileInput.value = '';
		}
	}
</script>

<svelte:head>
	<title>recoral - Login page</title>
</svelte:head>

{#if !loading && settings}
	<div class="card mb-6 overflow-hidden">
		<button
			type="button"
			class="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
			onclick={() => (previewOpen = !previewOpen)}
		>
			Preview
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="size-4 shrink-0 transition-transform {previewOpen ? 'rotate-180' : ''}"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
			</svg>
		</button>
		{#if previewOpen}
			<div class="px-5 pb-5" transition:slide={{ duration: 200 }}>
				<LoginPreview
					backgroundImage={settings.backgroundImage}
					randomAccent={settings.defaultAccentHue === null}
					accentHue={settings.defaultAccentHue ?? lastPickedHue}
				/>
			</div>
		{/if}
	</div>

	<div class="card flex flex-col gap-5 p-5">
		<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Login page</h2>

		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-sm text-gray-900 dark:text-gray-100">Random login page color</p>
					<p class="text-xs text-gray-400">Off uses a fixed accent color instead of a random one each visit.</p>
				</div>
				<Toggle
					checked={settings.defaultAccentHue === null}
					onchange={(checked) => patchSettings({ defaultAccentHue: checked ? null : lastPickedHue })}
					label="Random login page color"
				/>
			</div>

			{#if settings.defaultAccentHue !== null}
				<ColorPicker
					value={settings.defaultAccentHue}
					onselect={(hue) => {
						lastPickedHue = hue;
						patchSettings({ defaultAccentHue: hue });
					}}
				/>
			{/if}
		</div>

		<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-sm text-gray-900 dark:text-gray-100">Login page background</p>
					<p class="text-xs text-gray-400">Shown behind the login card instead of a plain background.</p>
				</div>

				{#if settings.backgroundImage}
					<button
						type="button"
						class="group relative block size-16 shrink-0 overflow-hidden rounded-lg"
						onclick={() => patchSettings({ backgroundImage: null })}
						aria-label="Remove login page background"
					>
						<img
							src={settings.backgroundImage}
							alt="Login background"
							class="size-full object-cover transition group-hover:brightness-50"
						/>
						<span
							class="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" class="size-5">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6 6.5h12M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M7.5 6.5 8 19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-12.5"
								/>
							</svg>
						</span>
					</button>
				{:else}
					<button
						type="button"
						class="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 transition hover:bg-gray-100 disabled:opacity-60 dark:border-white/15 dark:text-gray-400 dark:hover:bg-white/5"
						onclick={() => bgFileInput?.click()}
						disabled={bgUploading}
					>
						{bgUploading ? '…' : 'Upload'}
					</button>
				{/if}
			</div>

			{#if bgError}
				<p class="text-sm text-red-600 dark:text-red-400">{bgError}</p>
			{/if}
			<input bind:this={bgFileInput} type="file" accept="image/*" class="hidden" onchange={onBackgroundSelected} />
		</div>
	</div>
{/if}
