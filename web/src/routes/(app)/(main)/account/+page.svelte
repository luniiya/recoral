<script lang="ts">
	import { api } from '$lib/api.svelte';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import ServerStatus from '$lib/components/ServerStatus.svelte';
</script>

<svelte:head>
	<title>recoral - Account</title>
</svelte:head>

{#if auth.user}
	<div class="flex h-full flex-col">
		<div class="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-6 pt-10">
			<div class="mb-8 flex flex-col items-center gap-2 text-center">
				<Avatar name={auth.user.username} avatar={auth.user.avatar} size="size-16" />
				<span class="text-sm font-medium text-gray-900 dark:text-gray-100">{auth.user.username}</span>
				{#if auth.user.email}
					<span class="-mt-1 text-xs text-gray-400">{auth.user.email}</span>
				{/if}
				{#if api.baseUrl}
					<span class="-mt-1 text-xs text-gray-400">{api.baseUrl}</span>
				{/if}
			</div>

			<div class="flex flex-col gap-3">
				<a
					href="/settings"
					class="card flex w-full items-center gap-3 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5 shrink-0 text-gray-500 dark:text-gray-400">
						<circle cx="12" cy="12" r="3" />
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
						/>
					</svg>
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Account settings</span>
				</a>

				{#if auth.user.isAdmin}
					<a
						href="/admin"
						class="card flex w-full items-center gap-3 p-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5 shrink-0 text-gray-500 dark:text-gray-400">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"
							/>
						</svg>
						<span class="text-sm font-medium text-gray-900 dark:text-gray-100">Administration</span>
					</a>
				{/if}

				<button
					class="card w-full p-4 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
					onclick={() => auth.logout()}
				>
					Sign out
				</button>
			</div>
		</div>

		<div class="mx-auto w-full max-w-xl px-6 pb-24 md:pb-6">
			<ServerStatus />
		</div>
	</div>
{/if}
