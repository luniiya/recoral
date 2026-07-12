<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import Avatar from './Avatar.svelte';

	let open = $state(false);
</script>

{#if auth.user}
	<div class="relative">
		<button
			class="block rounded-full transition hover:opacity-80"
			onclick={() => (open = !open)}
			aria-label="Account menu"
		>
			<Avatar name={auth.user.username} avatar={auth.user.avatar} />
		</button>

		{#if open}
			<button
				class="fixed inset-0 z-10 cursor-default"
				aria-label="Close menu"
				onclick={() => (open = false)}
			></button>

			<div class="card absolute top-full right-0 z-20 mt-2 w-64 p-5">
				<div class="flex flex-col items-center gap-2 text-center">
					<Avatar name={auth.user.username} avatar={auth.user.avatar} size="size-14" />
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">{auth.user.username}</span>
					{#if auth.user.email}
						<span class="-mt-1 text-xs text-gray-400">{auth.user.email}</span>
					{/if}
				</div>

				<div class="mt-5 flex flex-col gap-2">
					<button
						class="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
						onclick={() => {
							open = false;
							goto('/settings');
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
							<circle cx="12" cy="12" r="3" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
							/>
						</svg>
						Account settings
					</button>
					<button
						class="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 py-2 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
						onclick={() => {
							open = false;
							goto('/admin');
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"
							/>
						</svg>
						Administration
					</button>
					<button
						class="w-full rounded-full py-2 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
						onclick={() => auth.logout()}
					>
						Sign out
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
