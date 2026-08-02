<script lang="ts">
	import { USERNAME_CHANGE_COOLDOWN_DAYS, validatePassword } from '@recoral/shared';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import PasswordMatchHint from '$lib/components/PasswordMatchHint.svelte';
	import PasswordStrengthHint from '$lib/components/PasswordStrengthHint.svelte';
	import { api } from '$lib/api.svelte';
	import { readAsDataUrl } from '$lib/file';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';

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

	// Account details: username/email/password. Initialized once from
	// auth.user (this component only ever renders once auth.user exists, see
	// the {#if auth.user} gate below), then kept in sync manually after a
	// successful save rather than re-deriving reactively.
	let detailsUsername = $state(auth.user?.username ?? '');
	let detailsEmail = $state(auth.user?.email ?? '');
	let newPassword = $state('');
	let newConfirmPassword = $state('');
	let currentPassword = $state('');
	let detailsSaving = $state(false);
	let detailsError = $state('');
	let detailsSuccess = $state('');
	let requireStrongPasswords = $state(true);
	let requireEmail = $state(false);
	// Password fields stay unmounted until explicitly opened. Browsers will
	// happily autofill a bare "new password" input with the account's existing
	// saved password on page load, silently flipping hasChanges true and
	// tripping the strength check on a change the user never asked for, locking
	// them out of saving an unrelated username/email edit. Gating behind a
	// click means nothing autofills until the user actually means to type here.
	let changingPassword = $state(false);

	function cancelChangePassword() {
		changingPassword = false;
		newPassword = '';
		newConfirmPassword = '';
	}

	// Username changes are rate-limited server-side (once per
	// USERNAME_CHANGE_COOLDOWN_DAYS, signup doesn't count as a change); this
	// mirrors that client-side so the field is disabled with an explanation
	// instead of letting someone fill it in only to get a 400 on save.
	let usernameLockedUntil = $derived.by(() => {
		if (!auth.user?.usernameChangedAt) return null;
		const next = new Date(
			new Date(auth.user.usernameChangedAt).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
		);
		return next > new Date() ? next : null;
	});

	let deleteDialogOpen = $state(false);
	let deletePassword = $state('');
	let deleteError = $state('');
	let deleting = $state(false);

	function openDeleteDialog() {
		deleteDialogOpen = true;
		deletePassword = '';
		deleteError = '';
	}

	async function confirmDeleteAccount() {
		deleteError = '';
		deleting = true;
		try {
			await auth.deleteAccount(deletePassword);
			goto('/login');
		} catch (err) {
			deleteError = (err as Error).message;
		} finally {
			deleting = false;
		}
	}

	onMount(async () => {
		const res = await api.fetch('/api/settings');
		if (res.ok) {
			const settings = await res.json();
			requireStrongPasswords = settings.requireStrongPasswords;
			requireEmail = settings.requireEmail;
		}
	});

	let hasChanges = $derived(
		detailsUsername !== auth.user?.username ||
			detailsEmail !== (auth.user?.email ?? '') ||
			newPassword !== ''
	);

	async function saveAccountDetails() {
		detailsError = '';
		detailsSuccess = '';
		if (!hasChanges) return;

		if (requireEmail && !detailsEmail) {
			detailsError = 'Email is required';
			return;
		}

		if (newPassword !== newConfirmPassword) {
			detailsError = "Passwords don't match";
			return;
		}
		if (newPassword) {
			const check = validatePassword(newPassword, requireStrongPasswords);
			if (!check.valid) {
				detailsError = check.reason ?? 'Invalid password';
				return;
			}
		}

		const updates: {
			username?: string;
			email?: string | null;
			password?: string;
			currentPassword?: string;
		} = { currentPassword };
		if (detailsUsername !== auth.user?.username) updates.username = detailsUsername;
		if (detailsEmail !== (auth.user?.email ?? '')) updates.email = detailsEmail || null;
		if (newPassword) updates.password = newPassword;

		detailsSaving = true;
		try {
			await auth.updateAccount(updates);
			newPassword = '';
			newConfirmPassword = '';
			currentPassword = '';
			detailsSuccess = 'Saved';
		} catch (err) {
			detailsError = (err as Error).message;
		} finally {
			detailsSaving = false;
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
				class="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-white text-gray-600 shadow ring-1 ring-gray-200 transition hover:text-accent-600 disabled:opacity-60 dark:bg-neutral-800 dark:text-gray-300 dark:ring-white/10"
				onclick={() => fileInput?.click()}
				aria-label="Change profile picture"
				disabled={saving}
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
		{#if saving}
			<p class="text-xs text-gray-400">Uploading…</p>
		{/if}
		{#if error}
			<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
		{/if}
	</div>

	<div class="card p-6">
		<h2 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Account details</h2>
		<p class="mb-5 text-sm text-gray-500 dark:text-gray-400">
			Changing your username, email, or password requires your current password.
		</p>

		<div class="flex flex-col gap-4">
			<label class="flex flex-col gap-1.5">
				<span class="form-label">Username</span>
				<input
					class="form-input"
					bind:value={detailsUsername}
					minlength="3"
					maxlength="32"
					pattern="[a-zA-Z0-9_.-]+"
					autocomplete="username"
					disabled={!!usernameLockedUntil}
				/>
				{#if usernameLockedUntil}
					<p class="text-xs text-gray-400">
						You can change your username again on {usernameLockedUntil.toLocaleDateString()}.
					</p>
				{/if}
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="form-label">
					Email {#if !requireEmail}<span class="text-gray-400">(optional)</span>{/if}
				</span>
				<input
					class="form-input"
					type="email"
					bind:value={detailsEmail}
					required={requireEmail}
					autocomplete="email"
				/>
			</label>

			<div class="flex flex-col gap-4 border-t border-gray-100 pt-4 dark:border-white/10">
				{#if !changingPassword}
					<button
						type="button"
						class="self-start text-sm font-medium text-accent-600 hover:underline dark:text-accent-400"
						onclick={() => (changingPassword = true)}
					>
						Change password
					</button>
				{:else}
					<div class="flex flex-col gap-4" transition:slide={{ duration: 200 }}>
						<label class="flex flex-col gap-1.5">
							<span class="form-label">New password</span>
							<PasswordInput bind:value={newPassword} minlength={8} autocomplete="new-password" />
							<PasswordStrengthHint password={newPassword} requireStrong={requireStrongPasswords} />
						</label>

						<label class="flex flex-col gap-1.5">
							<span class="form-label">Confirm new password</span>
							<PasswordInput bind:value={newConfirmPassword} minlength={8} autocomplete="new-password" />
							<PasswordMatchHint password={newPassword} confirm={newConfirmPassword} />
						</label>

						<button
							type="button"
							class="self-start text-sm text-gray-400 hover:underline"
							onclick={cancelChangePassword}
						>
							Cancel password change
						</button>
					</div>
				{/if}
			</div>

			<label class="flex flex-col gap-1.5 border-t border-gray-100 pt-4 dark:border-white/10">
				<span class="form-label">Current password</span>
				<PasswordInput bind:value={currentPassword} autocomplete="current-password" />
			</label>

			{#if detailsError}
				<p class="text-sm text-red-600 dark:text-red-400">{detailsError}</p>
			{/if}
			{#if detailsSuccess}
				<p class="text-sm text-green-600 dark:text-green-400">{detailsSuccess}</p>
			{/if}

			<button
				class="self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
				disabled={detailsSaving || !hasChanges || !currentPassword}
				onclick={saveAccountDetails}
			>
				{detailsSaving ? 'Saving…' : 'Save changes'}
			</button>
		</div>
	</div>

	<div class="card mt-6 border-red-200 p-6 dark:border-red-500/20">
		<h2 class="mb-1 text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
		<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
			Permanently deletes your account, every recording, and every tag. There's no undoing this.
		</p>
		<button
			class="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
			onclick={openDeleteDialog}
		>
			Delete account
		</button>
	</div>
{/if}

{#if deleteDialogOpen}
	<Dialog onclose={() => (deleteDialogOpen = false)} centered maxWidth="max-w-sm">
		<div class="flex flex-col gap-4 text-left">
			<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete your account?</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				This permanently deletes your account, every recording, and every tag. There's no undoing this. Enter
				your password to confirm.
			</p>
			<PasswordInput placeholder="Current password" bind:value={deletePassword} autocomplete="current-password" />
			{#if deleteError}
				<p class="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
			{/if}
			<div class="flex justify-end gap-2">
				<button
					class="rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
					onclick={() => (deleteDialogOpen = false)}
					disabled={deleting}
				>
					Cancel
				</button>
				<button
					class="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
					onclick={confirmDeleteAccount}
					disabled={deleting || !deletePassword}
				>
					{deleting ? 'Deleting…' : 'Delete account'}
				</button>
			</div>
		</div>
	</Dialog>
{/if}
