<script lang="ts">
	import type { AdminUserSummary, Settings } from '@recoral/shared';
	import { validatePassword } from '@recoral/shared';
	import Avatar from './Avatar.svelte';
	import OverflowMenu from './OverflowMenu.svelte';
	import PasswordInput from './PasswordInput.svelte';
	import PasswordMatchHint from './PasswordMatchHint.svelte';
	import StatCard from './StatCard.svelte';
	import Toggle from './Toggle.svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		user: AdminUserSummary;
		settings: Settings;
		isSelf: boolean;
		error: string;
		onPatch: (updates: { isAdmin?: boolean; storageLimitMb?: number | null; password?: string }) => Promise<boolean>;
		onDeleteRequest: () => void;
	}

	let { user, settings, isSelf, error, onPatch, onDeleteRequest }: Props = $props();

	let usedGb = $derived(user.storageUsedBytes / 1024 ** 3);
	let effectiveLimitMb = $derived(user.storageLimitMb ?? settings.serverStorageLimitMb);
	let limitGb = $derived(effectiveLimitMb !== null ? effectiveLimitMb / 1024 : null);
	let usedPercent = $derived(limitGb !== null && limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0);

	let changingPassword = $state(false);
	let resetPassword = $state('');
	let resetConfirmPassword = $state('');
	let resetPasswordError = $state('');
	let resettingPassword = $state(false);

	function cancelChangePassword() {
		changingPassword = false;
		resetPassword = '';
		resetConfirmPassword = '';
		resetPasswordError = '';
	}

	async function submitResetPassword() {
		resetPasswordError = '';
		if (resetPassword !== resetConfirmPassword) {
			resetPasswordError = "Passwords don't match";
			return;
		}
		const check = validatePassword(resetPassword, settings.requireStrongPasswords);
		if (!check.valid) {
			resetPasswordError = check.reason ?? 'Invalid password';
			return;
		}
		resettingPassword = true;
		try {
			const ok = await onPatch({ password: resetPassword });
			if (ok) cancelChangePassword();
			else resetPasswordError = error;
		} finally {
			resettingPassword = false;
		}
	}
</script>

<div class="flex flex-col gap-5 text-left">
	<div class="flex items-center justify-end">
		<OverflowMenu label={`More options for ${user.username}`}>
			{#snippet menu(close)}
				<button
					class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
					onclick={() => {
						close();
						changingPassword = true;
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
				{#if !isSelf}
					<button
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
						onclick={() => {
							close();
							onDeleteRequest();
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

	<div>
		<div class="mb-6 flex flex-col items-center gap-2 text-center">
			<Avatar name={user.username} avatar={user.avatar} size="size-16" />
			<div>
				<p class="text-base font-semibold text-gray-900 dark:text-gray-100">
					{user.username}
					{#if isSelf}<span class="ml-1 text-sm font-normal text-gray-400">(you)</span>{/if}
				</p>
				{#if user.email}
					<p class="text-sm text-gray-400">{user.email}</p>
				{/if}
			</div>
			{#if user.isAdmin}
				<span
					class="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
				>
					Admin
				</span>
			{/if}
		</div>

		<div class="mb-6 grid grid-cols-2 gap-3">
			<StatCard value={user.recordingCount} label={user.recordingCount === 1 ? 'Recording' : 'Recordings'} />
			<StatCard value="{usedGb.toFixed(1)} GB" label="Storage used" />
		</div>

		<div class="card mb-4 flex flex-col gap-3 p-4">
			<div>
				<p class="text-sm text-gray-900 dark:text-gray-100">Storage</p>
				<p class="text-xs text-gray-400">
					{#if limitGb !== null}
						{usedGb.toFixed(1)} GB of {limitGb.toFixed(1)} GB used
					{:else}
						{usedGb.toFixed(1)} GB used, unlimited
					{/if}
				</p>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
				<div class="h-full rounded-full bg-accent-500" style:width="{usedPercent}%"></div>
			</div>

			<label class="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				Storage limit
				<input
					type="number"
					min="0"
					placeholder="Shared pool"
					value={user.storageLimitMb ?? ''}
					class="w-24 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-accent-500 dark:bg-white/5 dark:text-gray-100"
					onchange={(e) => {
						const raw = e.currentTarget.value.trim();
						onPatch({ storageLimitMb: raw === '' ? null : Number(raw) });
					}}
				/>
				MB
			</label>
		</div>

		<div class="card flex items-center justify-between gap-4 p-4">
			<div>
				<p class="text-sm text-gray-900 dark:text-gray-100">Admin access</p>
				<p class="text-xs text-gray-400">Can manage users and server settings.</p>
			</div>
			<Toggle
				checked={user.isAdmin}
				disabled={isSelf}
				onchange={(checked) => onPatch({ isAdmin: checked })}
				label={`Admin access for ${user.username}`}
			/>
		</div>

		<p class="mt-4 text-xs text-gray-400">Joined {new Date(user.createdAt).toLocaleDateString()}</p>

		{#if error && !changingPassword}
			<p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
		{/if}

		{#if changingPassword}
			<div class="card mt-6 flex flex-col gap-3 p-4" transition:slide={{ duration: 200 }}>
				<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Change password</p>
				<PasswordInput placeholder="New password" bind:value={resetPassword} minlength={8} />
				<PasswordInput placeholder="Confirm new password" bind:value={resetConfirmPassword} minlength={8} />
				<PasswordMatchHint password={resetPassword} confirm={resetConfirmPassword} />
				{#if resetPasswordError}
					<p class="text-sm text-red-600 dark:text-red-400">{resetPasswordError}</p>
				{/if}
				<div class="flex items-center gap-2">
					<button
						class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-60"
						disabled={resettingPassword || !resetPassword}
						onclick={submitResetPassword}
					>
						{resettingPassword ? 'Setting…' : 'Set password'}
					</button>
					<button
						type="button"
						class="rounded-full px-4 py-2 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
						onclick={cancelChangePassword}
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
