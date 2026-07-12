<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';

	let saving = $state(false);
	let error = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	function readAsDataUrl(file: File) {
		return new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

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

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Account settings</h1>

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

	<div class="card p-6">
		<h2 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Accent color</h2>
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Applies across the whole app, on every device.</p>
		<ColorPicker value={auth.user.accentHue} onselect={onHueSelected} />
	</div>

	{#if error}
		<p class="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
	{/if}
{/if}
