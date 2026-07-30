<script lang="ts">
	import type { AdminUserSummary, Settings } from '@recoral/shared';
	import { validatePassword } from '@recoral/shared';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import PasswordMatchHint from '$lib/components/PasswordMatchHint.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import UserDetail from '$lib/components/UserDetail.svelte';
	import { api } from '$lib/api.svelte';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	let users = $state<AdminUserSummary[]>([]);
	let settings = $state<Settings | null>(null);
	let loading = $state(true);
	let usersError = $state('');

	let selectedUserId = $state<string | null>(null);
	let selectedUser = $derived(users.find((u) => u.id === selectedUserId) ?? null);

	let userSearch = $state('');
	let visibleUsers = $derived.by(() => {
		const query = userSearch.trim().toLowerCase();
		if (!query) return users;
		return users.filter(
			(u) => u.username.toLowerCase().includes(query) || (u.email ?? '').toLowerCase().includes(query)
		);
	});

	let showCreateUser = $state(false);
	let newUsername = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newConfirmPassword = $state('');
	let newIsAdmin = $state(false);
	let creatingUser = $state(false);
	let createUserError = $state('');

	let deleteTarget = $state<AdminUserSummary | null>(null);
	let deleting = $state(false);

	onMount(async () => {
		const [usersRes, settingsRes] = await Promise.all([
			api.fetch('/api/admin/users', { credentials: 'include' }),
			api.fetch('/api/settings')
		]);
		if (usersRes.ok) users = await usersRes.json();
		if (settingsRes.ok) settings = await settingsRes.json();
		loading = false;
	});

	async function patchUser(
		id: string,
		updates: { isAdmin?: boolean; storageLimitMb?: number | null; password?: string }
	) {
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
			return false;
		}
		users = users.map((u) => (u.id === id ? { ...u, ...body } : u));
		return true;
	}

	async function createUser() {
		createUserError = '';
		if ((settings?.requireEmail ?? false) && !newEmail) {
			createUserError = 'Email is required';
			return;
		}
		if (newPassword !== newConfirmPassword) {
			createUserError = "Passwords don't match";
			return;
		}
		const check = validatePassword(newPassword, settings?.requireStrongPasswords ?? true);
		if (!check.valid) {
			createUserError = check.reason ?? 'Invalid password';
			return;
		}
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
			users = [...users, { ...body, recordingCount: 0, storageUsedBytes: 0 }];
			showCreateUser = false;
			newUsername = '';
			newEmail = '';
			newPassword = '';
			newConfirmPassword = '';
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
				if (selectedUserId === deleteTarget.id) selectedUserId = null;
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
	<title>recoral - Users</title>
</svelte:head>

<div class="mx-auto h-full w-full max-w-xl overflow-y-auto px-6 py-6 pb-24 md:py-10 md:pb-10">
	{#if !loading}
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
			<div
				class="mb-5 flex flex-col gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/5"
				transition:slide={{ duration: 200 }}
			>
				<div class="flex flex-wrap gap-2">
					<input
						type="text"
						placeholder="Username"
						bind:value={newUsername}
						minlength="3"
						maxlength="32"
						pattern="[a-zA-Z0-9_.-]+"
						class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
					<input
						type="email"
						placeholder={settings?.requireEmail ?? false ? 'Email' : 'Email (optional)'}
						bind:value={newEmail}
						required={settings?.requireEmail ?? false}
						class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
					<PasswordInput
						placeholder="Password"
						bind:value={newPassword}
						minlength={8}
						class="min-w-0 flex-1"
						inputClass="w-full rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
					<PasswordInput
						placeholder="Confirm password"
						bind:value={newConfirmPassword}
						minlength={8}
						class="min-w-0 flex-1"
						inputClass="w-full rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
					/>
				</div>
				<PasswordMatchHint password={newPassword} confirm={newConfirmPassword} />
				<label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
					<Toggle checked={newIsAdmin} onchange={(checked) => (newIsAdmin = checked)} label="Make admin" />
					Make admin
				</label>
				{#if createUserError}
					<p class="text-sm text-red-600 dark:text-red-400">{createUserError}</p>
				{/if}
				<button
					class="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
					disabled={creatingUser ||
					!newUsername ||
					!newPassword ||
					((settings?.requireEmail ?? false) && !newEmail)}
					onclick={createUser}
				>
					{creatingUser ? 'Creating…' : 'Create account'}
				</button>
			</div>
		{/if}

		{#if usersError && !selectedUser}
			<p class="mb-3 text-sm text-red-600 dark:text-red-400">{usersError}</p>
		{/if}

		{#if users.length > 5}
			<input
				type="search"
				placeholder="Search users"
				bind:value={userSearch}
				class="mb-3 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
			/>
		{/if}

		{#if userSearch.trim() && visibleUsers.length === 0}
			<p class="py-4 text-center text-sm text-gray-400">No users match "{userSearch.trim()}".</p>
		{/if}

		<ul class="flex flex-col gap-1">
			{#each visibleUsers as user (user.id)}
				<li>
					<button
						class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-gray-100 dark:hover:bg-white/5"
						onclick={() => (selectedUserId = user.id)}
					>
						<Avatar name={user.username} avatar={user.avatar} />
						<p class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-gray-900 dark:text-gray-100">
							{user.username}
							{#if user.id === auth.user?.id}<span class="text-gray-400">(you)</span>{/if}
							{#if user.isAdmin}
								<span
									class="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
								>
									Admin
								</span>
							{/if}
						</p>
						<p class="hidden min-w-0 flex-1 truncate text-xs text-gray-400 sm:block">
							{user.email ?? '—'}
						</p>
						<p class="shrink-0 text-xs text-gray-400 tabular-nums">
							{(user.storageUsedBytes / 1024 ** 3).toFixed(1)} GB
						</p>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if selectedUser && settings}
	<Dialog onclose={() => (selectedUserId = null)} centered maxWidth="max-w-md">
		<UserDetail
			user={selectedUser}
			{settings}
			isSelf={selectedUser.id === auth.user?.id}
			error={usersError}
			onPatch={(updates) => patchUser(selectedUser.id, updates)}
			onDeleteRequest={() => {
				selectedUserId = null;
				deleteTarget = selectedUser;
			}}
		/>
	</Dialog>
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
