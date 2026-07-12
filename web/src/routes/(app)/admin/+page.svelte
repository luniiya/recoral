<script lang="ts">
	import type { User } from '@recoral/shared';
	import Avatar from '$lib/components/Avatar.svelte';
	import { onMount } from 'svelte';

	let users = $state<User[]>([]);
	let serverOnline = $state<boolean | null>(null);
	let loading = $state(true);

	onMount(async () => {
		const [usersRes, healthRes] = await Promise.all([
			fetch('/api/admin/users', { credentials: 'include' }),
			fetch('/api/health')
		]);
		if (usersRes.ok) users = await usersRes.json();
		serverOnline = healthRes.ok;
		loading = false;
	});
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
