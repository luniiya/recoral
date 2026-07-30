<script lang="ts">
	import type { Settings } from '@recoral/shared';
	import Toggle from '$lib/components/Toggle.svelte';
	import { api } from '$lib/api.svelte';
	import { onMount } from 'svelte';

	let settings = $state<Settings | null>(null);
	let serverOnline = $state<boolean | null>(null);
	let serverVersion = $state('');
	let loading = $state(true);

	onMount(async () => {
		const [healthRes, settingsRes] = await Promise.all([
			api.fetch('/api/health'),
			api.fetch('/api/settings')
		]);
		if (settingsRes.ok) settings = await settingsRes.json();
		if (healthRes.ok) {
			const health = await healthRes.json();
			serverOnline = true;
			serverVersion = health.version;
		} else {
			serverOnline = false;
		}
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
</script>

<svelte:head>
	<title>recoral - Administration</title>
</svelte:head>

<div class="mx-auto h-full w-full max-w-xl overflow-y-auto px-6 pb-24 md:pb-10">
{#if !loading}
	<div class="card mb-6 flex items-center justify-between p-5">
		<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Server</span>
		<span class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span class="size-2 rounded-full {serverOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
			{serverOnline ? 'Online' : 'Unreachable'}
			{#if serverVersion}<span class="text-gray-300 dark:text-gray-600">v{serverVersion}</span>{/if}
		</span>
	</div>

	{#if settings}
		<div class="card flex flex-col gap-5 p-5">
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

			<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm text-gray-900 dark:text-gray-100">Require strong passwords</p>
						<p class="text-xs text-gray-400">
							Minimum 8 characters plus at least 2 of uppercase, lowercase, numbers, symbols. Applies to every account.
						</p>
					</div>
					<Toggle
						checked={settings.requireStrongPasswords}
						onchange={(checked) => patchSettings({ requireStrongPasswords: checked })}
						label="Require strong passwords"
					/>
				</div>
			</div>

			<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm text-gray-900 dark:text-gray-100">Require email</p>
						<p class="text-xs text-gray-400">
							Off makes email optional (complementary) on signup and account forms. On makes it mandatory.
						</p>
					</div>
					<Toggle
						checked={settings.requireEmail}
						onchange={(checked) => patchSettings({ requireEmail: checked })}
						label="Require email"
					/>
				</div>
			</div>

			<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm text-gray-900 dark:text-gray-100">Limit total storage</p>
						<p class="text-xs text-gray-400">
							Shared across every user. A user without their own limit falls back to this.
						</p>
					</div>
					<Toggle
						checked={settings.serverStorageLimitMb !== null}
						onchange={(checked) => patchSettings({ serverStorageLimitMb: checked ? 204800 : null })}
						label="Limit total storage"
					/>
				</div>

				{#if settings.serverStorageLimitMb !== null}
					<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
						<input
							type="number"
							min="1"
							value={Math.round(settings.serverStorageLimitMb / 1024)}
							class="w-24 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
							onchange={(e) => {
								const gb = Number(e.currentTarget.value);
								if (gb > 0) patchSettings({ serverStorageLimitMb: Math.round(gb * 1024) });
							}}
						/>
						GB
					</label>
				{/if}
			</div>

			<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
				<div>
					<p class="text-sm text-gray-900 dark:text-gray-100">Max import upload size</p>
					<p class="text-xs text-gray-400">
						Caps a single import upload (e.g. a Google Takeout export) for every user. Up to 10GB.
					</p>
				</div>
				<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
					<input
						type="number"
						min="1"
						max="10240"
						value={Math.round(settings.maxImportSizeMb / 1024)}
						class="w-24 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
						onchange={(e) => {
							const gb = Number(e.currentTarget.value);
							if (gb > 0) patchSettings({ maxImportSizeMb: Math.round(gb * 1024) });
						}}
					/>
					GB
				</label>
			</div>
		</div>
	{/if}
{/if}
</div>
