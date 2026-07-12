<script lang="ts">
	import type { Settings, User } from '@recoral/shared';
	import Avatar from '$lib/components/Avatar.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import { onMount } from 'svelte';

	let users = $state<User[]>([]);
	let settings = $state<Settings | null>(null);
	let serverOnline = $state<boolean | null>(null);
	let loading = $state(true);
	let lastPickedHue = $state(26);

	onMount(async () => {
		const [usersRes, healthRes, settingsRes] = await Promise.all([
			fetch('/api/admin/users', { credentials: 'include' }),
			fetch('/api/health'),
			fetch('/api/settings')
		]);
		if (usersRes.ok) users = await usersRes.json();
		if (settingsRes.ok) settings = await settingsRes.json();
		serverOnline = healthRes.ok;
		loading = false;
	});

	async function patchSettings(updates: Partial<Settings>) {
		const res = await fetch('/api/admin/settings', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(updates)
		});
		if (res.ok) settings = await res.json();
	}
</script>

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Administration</h1>

{#if !loading}
	<div class="card mb-6 flex items-center justify-between p-5">
		<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Server</span>
		<span class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span class="size-2 rounded-full {serverOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
			{serverOnline ? 'Online' : 'Unreachable'}
		</span>
	</div>

	{#if settings}
		<div class="card mb-6 flex flex-col gap-5 p-5">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Settings</h2>

			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-sm text-gray-900 dark:text-gray-100">Allow sign ups</p>
					<p class="text-xs text-gray-400">Anyone can create an account when this is on.</p>
				</div>
				<Toggle
					checked={settings.signupEnabled}
					onchange={(checked) => patchSettings({ signupEnabled: checked })}
					label="Allow sign ups"
				/>
			</div>

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
		</div>
	{/if}

	<div class="card p-5">
		<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
			Users <span class="text-gray-400">({users.length})</span>
		</h2>
		<ul class="flex flex-col gap-3">
			{#each users as user (user.id)}
				<li class="flex items-center gap-3">
					<Avatar name={user.username} avatar={user.avatar} />
					<div class="min-w-0">
						<p class="truncate text-sm text-gray-900 dark:text-gray-100">
							{user.username}
							{#if user.email}<span class="text-gray-400">{user.email}</span>{/if}
						</p>
						<p class="text-xs text-gray-400">
							Joined {new Date(user.createdAt).toLocaleDateString()}
						</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
