<script lang="ts">
	import type { Settings, User } from '@recoral/shared';
	import { validatePassword } from '@recoral/shared';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import OverflowMenu from '$lib/components/OverflowMenu.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import PasswordMatchHint from '$lib/components/PasswordMatchHint.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import { api } from '$lib/api.svelte';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

	let users = $state<User[]>([]);
	let settings = $state<Settings | null>(null);
	let loading = $state(true);
	let usersError = $state('');

	let showCreateUser = $state(false);
	let newUsername = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newConfirmPassword = $state('');
	let newIsAdmin = $state(false);
	let creatingUser = $state(false);
	let createUserError = $state('');

	let deleteTarget = $state<User | null>(null);
	let deleting = $state(false);

	// Which user row has its password-reset form expanded, if any (inline
	// expand/collapse, matching the showCreateUser pattern above, not a modal).
	let resetPasswordTarget = $state<string | null>(null);
	let resetPassword = $state('');
	let resetConfirmPassword = $state('');
	let resetPasswordError = $state('');
	let resettingPassword = $state(false);

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
		users = users.map((u) => (u.id === id ? body : u));
		return true;
	}

	function openResetPassword(id: string) {
		resetPasswordTarget = resetPasswordTarget === id ? null : id;
		resetPassword = '';
		resetConfirmPassword = '';
		resetPasswordError = '';
	}

	async function submitResetPassword(id: string) {
		resetPasswordError = '';
		if (resetPassword !== resetConfirmPassword) {
			resetPasswordError = "Passwords don't match";
			return;
		}
		const check = validatePassword(resetPassword, settings?.requireStrongPasswords ?? true);
		if (!check.valid) {
			resetPasswordError = check.reason ?? 'Invalid password';
			return;
		}
		resettingPassword = true;
		try {
			const ok = await patchUser(id, { password: resetPassword });
			if (ok) resetPasswordTarget = null;
			else resetPasswordError = usersError;
		} finally {
			resettingPassword = false;
		}
	}

	async function createUser() {
		createUserError = '';
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
			users = [...users, body];
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

{#if !loading}
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
			<div class="mb-5 flex flex-col gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/5" transition:slide={{ duration: 200 }}>
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
						placeholder="Email (optional)"
						bind:value={newEmail}
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
					disabled={creatingUser || !newUsername || !newPassword}
					onclick={createUser}
				>
					{creatingUser ? 'Creating…' : 'Create account'}
				</button>
			</div>
		{/if}

		{#if usersError && resetPasswordTarget === null}
			<p class="mb-3 text-sm text-red-600 dark:text-red-400">{usersError}</p>
		{/if}

		<ul class="flex flex-col gap-4">
			{#each users as user (user.id)}
				<li class="flex flex-col gap-3">
					<div class="flex flex-wrap items-center gap-3">
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

						<OverflowMenu label={`More options for ${user.username}`}>
							{#snippet menu(close)}
								<button
									class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
									onclick={() => {
										close();
										openResetPassword(user.id);
									}}
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"
										/>
									</svg>
									Change password
								</button>
								{#if user.id !== auth.user?.id}
									<button
										class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
										onclick={() => {
											close();
											deleteTarget = user;
										}}
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M6 6.5h12M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M7.5 6.5 8 19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-12.5"
											/>
										</svg>
										Delete account
									</button>
								{/if}
							{/snippet}
						</OverflowMenu>
					</div>

					{#if resetPasswordTarget === user.id}
						<div class="flex flex-col gap-2 rounded-xl bg-gray-50 p-4 dark:bg-white/5" transition:slide={{ duration: 200 }}>
							<div class="flex flex-wrap gap-2">
								<PasswordInput
									placeholder="New password"
									bind:value={resetPassword}
									minlength={8}
									class="min-w-0 flex-1"
									inputClass="w-full rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
								/>
								<PasswordInput
									placeholder="Confirm new password"
									bind:value={resetConfirmPassword}
									minlength={8}
									class="min-w-0 flex-1"
									inputClass="w-full rounded-lg bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-accent-500 dark:bg-neutral-800 dark:text-gray-100 dark:ring-white/10"
								/>
							</div>
							<PasswordMatchHint password={resetPassword} confirm={resetConfirmPassword} />
							{#if resetPasswordError}
								<p class="text-sm text-red-600 dark:text-red-400">{resetPasswordError}</p>
							{/if}
							<button
								class="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
								disabled={resettingPassword || !resetPassword}
								onclick={() => submitResetPassword(user.id)}
							>
								{resettingPassword ? 'Setting…' : 'Set password'}
							</button>
						</div>
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
