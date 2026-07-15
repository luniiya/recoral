<script lang="ts">
	import type { Settings, User } from '@recoral/shared';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import { api } from '$lib/api.svelte';
	import { readAsDataUrl } from '$lib/file';
	import { onMount } from 'svelte';

	let users = $state<User[]>([]);
	let settings = $state<Settings | null>(null);
	let serverOnline = $state<boolean | null>(null);
	let serverVersion = $state('');
	let loading = $state(true);
	let lastPickedHue = $state(26);
	let usersError = $state('');
	let bgFileInput: HTMLInputElement | undefined = $state();
	let bgUploading = $state(false);

	let showCreateUser = $state(false);
	let newUsername = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newIsAdmin = $state(false);
	let creatingUser = $state(false);
	let createUserError = $state('');

	let deleteTarget = $state<User | null>(null);
	let deleting = $state(false);

	onMount(async () => {
		const [usersRes, healthRes, settingsRes] = await Promise.all([
			api.fetch('/api/admin/users', { credentials: 'include' }),
			api.fetch('/api/health'),
			api.fetch('/api/settings')
		]);
		if (usersRes.ok) users = await usersRes.json();
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

	async function onBackgroundSelected(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		bgUploading = true;
		try {
			const dataUrl = await readAsDataUrl(file);
			await patchSettings({ backgroundImage: dataUrl });
		} finally {
			bgUploading = false;
		}
	}

	async function patchUser(id: string, updates: { isAdmin?: boolean; storageLimitMb?: number | null }) {
		usersError = '';
		const res = await api.fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(updates)
		});
		const body = await res.json();
		if (!res.ok) {
			usersError = body.error ?? 'Something went wrong';
			return;
		}
		users = users.map((u) => (u.id === id ? body : u));
	}

	async function createUser() {
		createUserError = '';
		creatingUser = true;
		try {
			const res = await api.fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					username: newUsername,
					email: newEmail || undefined,
					password: newPassword,
					isAdmin: newIsAdmin
				})
			});
			const body = await res.json();
			if (!res.ok) {
				createUserError = body.error ?? 'Something went wrong';
				return;
			}
			users = [...users, body];
			showCreateUser = false;
			newUsername = '';
			newEmail = '';
			newPassword = '';
			newIsAdmin = false;
		} finally {
			creatingUser = false;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			const res = await api.fetch(`/api/admin/users/${deleteTarget.id}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (res.ok || res.status === 204) {
				users = users.filter((u) => u.id !== deleteTarget?.id);
				deleteTarget = null;
			} else {
				const body = await res.json().catch(() => ({}));
				usersError = body.error ?? 'Something went wrong';
			}
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>recoral - Administration</title>
</svelte:head>

<div class="mb-6 flex items-center gap-3">
	<BackButton href="/account" label="Back to account" />
	<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Administration</h1>
</div>

{#if !loading && auth.user && !auth.user.isAdmin}
	<div class="card p-8 text-center text-sm text-gray-400">You don't have access to this page.</div>
{:else if !loading}
	<div class="card mb-6 flex items-center justify-between p-5">
		<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Server</span>
		<span class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span class="size-2 rounded-full {serverOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
			{serverOnline ? 'Online' : 'Unreachable'}
			{#if serverVersion}<span class="text-gray-300 dark:text-gray-600">v{serverVersion}</span>{/if}
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
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm text-gray-900 dark:text-gray-100">Transcription</p>
						<p class="text-xs text-gray-400">
							Requires the transcription service (whisper.cpp) running alongside the server.
						</p>
					</div>
					<Toggle
						checked={settings.transcriptionEnabled}
						onchange={(checked) => patchSettings({ transcriptionEnabled: checked })}
						label="Transcription"
					/>
				</div>

				{#if settings.transcriptionEnabled}
					<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
						Model
						<select
							value={settings.transcriptionModel}
							class="rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
							onchange={(e) =>
								patchSettings({ transcriptionModel: e.currentTarget.value as Settings['transcriptionModel'] })}
						>
							<option value="tiny">Tiny — fastest, least accurate</option>
							<option value="base">Base — fast</option>
							<option value="small">Small — balanced (recommended)</option>
							<option value="medium">Medium — slower, more accurate</option>
							<option value="large">Large — slowest, most accurate</option>
						</select>
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

			<div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/10">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-sm text-gray-900 dark:text-gray-100">Login page background</p>
						<p class="text-xs text-gray-400">Shown behind the login card instead of a plain background.</p>
					</div>
					{#if settings.backgroundImage}
						<button
							class="shrink-0 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
							onclick={() => patchSettings({ backgroundImage: null })}
						>
							Remove
						</button>
					{/if}
				</div>

				{#if settings.backgroundImage}
					<div class="h-28 w-full overflow-hidden rounded-lg">
						<img src={settings.backgroundImage} alt="Login background" class="size-full object-cover" />
					</div>
				{:else}
					<button
						class="self-start rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
						onclick={() => bgFileInput?.click()}
						disabled={bgUploading}
					>
						{bgUploading ? 'Uploading…' : 'Upload image'}
					</button>
				{/if}
				<input
					bind:this={bgFileInput}
					type="file"
					accept="image/*"
					class="hidden"
					onchange={onBackgroundSelected}
				/>
			</div>
		</div>
	{/if}

	<div class="card p-5">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
				Users <span class="text-gray-400">({users.length})</span>
			</h2>
			<button
				class="rounded-full bg-accent-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
				onclick={() => (showCreateUser = !showCreateUser)}
			>
				{showCreateUser ? 'Cancel' : 'Create user'}
			</button>
		</div>

		{#if showCreateUser}
			<div class="mb-5 flex flex-col gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/5">
				<div class="flex flex-wrap gap-2">
					<input
						type="text"
						placeholder="Username"
						bind:value={newUsername}
						class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
					<input
						type="email"
						placeholder="Email (optional)"
						bind:value={newEmail}
						class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
					<input
						type="password"
						placeholder="Password"
						bind:value={newPassword}
						class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
				</div>
				<label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
					<Toggle checked={newIsAdmin} onchange={(checked) => (newIsAdmin = checked)} label="Make admin" />
					Make admin
				</label>
				{#if createUserError}
					<p class="text-sm text-red-600 dark:text-red-400">{createUserError}</p>
				{/if}
				<button
					class="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
					disabled={creatingUser || !newUsername || !newPassword}
					onclick={createUser}
				>
					{creatingUser ? 'Creating…' : 'Create account'}
				</button>
			</div>
		{/if}

		{#if usersError}
			<p class="mb-3 text-sm text-red-600 dark:text-red-400">{usersError}</p>
		{/if}

		<ul class="flex flex-col gap-4">
			{#each users as user (user.id)}
				<li class="flex flex-wrap items-center gap-3">
					<Avatar name={user.username} avatar={user.avatar} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm text-gray-900 dark:text-gray-100">
							{user.username}
							{#if user.id === auth.user?.id}<span class="text-gray-400">(you)</span>{/if}
							{#if user.email}<span class="text-gray-400">{user.email}</span>{/if}
						</p>
						<p class="text-xs text-gray-400">
							Joined {new Date(user.createdAt).toLocaleDateString()}
						</p>
					</div>

					<label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
						Storage limit
						<input
							type="number"
							min="0"
							placeholder="Unlimited"
							value={user.storageLimitMb ?? ''}
							class="w-24 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
							onchange={(e) => {
								const raw = e.currentTarget.value.trim();
								patchUser(user.id, { storageLimitMb: raw === '' ? null : Number(raw) });
							}}
						/>
						MB
					</label>

					<label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
						Admin
						<Toggle
							checked={user.isAdmin}
							disabled={user.id === auth.user?.id}
							onchange={(checked) => patchUser(user.id, { isAdmin: checked })}
							label={`Admin access for ${user.username}`}
						/>
					</label>

					{#if user.id !== auth.user?.id}
						<button
							class="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
							aria-label={`Delete ${user.username}`}
							onclick={() => (deleteTarget = user)}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6 6.5h12M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M7.5 6.5 8 19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-12.5"
								/>
							</svg>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

{#if deleteTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
		<div class="card w-full max-w-sm p-6">
			<h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Delete {deleteTarget.username}?</h3>
			<p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
				This permanently deletes their account, every recording, and every tag. There's no undoing this.
			</p>
			<div class="flex justify-end gap-2">
				<button
					class="rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={() => (deleteTarget = null)}
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					class="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
					onclick={confirmDelete}
					disabled={deleting}
				>
					{deleting ? 'Deleting…' : 'Delete account'}
				</button>
			</div>
		</div>
	</div>
{/if}
