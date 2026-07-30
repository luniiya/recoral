<script lang="ts">
	import type { SessionSummary } from '@recoral/shared';
	import { api } from '$lib/api.svelte';
	import { onMount } from 'svelte';

	let sessions = $state<SessionSummary[]>([]);
	let loading = $state(true);
	let error = $state('');
	let revokingId = $state<string | null>(null);

	onMount(async () => {
		const res = await api.fetch('/api/account/sessions', { credentials: 'include' });
		if (res.ok) sessions = await res.json();
		loading = false;
	});

	async function revoke(id: string) {
		error = '';
		revokingId = id;
		try {
			const res = await api.fetch(`/api/account/sessions/${id}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (res.ok || res.status === 204) {
				sessions = sessions.filter((s) => s.id !== id);
			} else {
				const body = await res.json().catch(() => ({}));
				error = body.error ?? 'Something went wrong';
			}
		} finally {
			revokingId = null;
		}
	}

	function lastActive(session: SessionSummary) {
		return new Date(session.lastSeenAt ?? session.createdAt).toLocaleString();
	}
</script>

<svelte:head>
	<title>recoral - Sessions</title>
</svelte:head>

{#if !loading}
	<div class="card p-5">
		<h2 class="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Sessions</h2>
		<p class="mb-5 text-sm text-gray-500 dark:text-gray-400">Every device currently signed into your account.</p>

		{#if error}
			<p class="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
		{/if}

		<ul class="flex flex-col gap-1">
			{#each sessions as session (session.id)}
				<li class="flex items-center gap-3 rounded-lg p-2">
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
					>
						{#if session.device === 'mobile'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
								<rect x="7" y="2.5" width="10" height="19" rx="2" />
								<path stroke-linecap="round" d="M11 18.5h2" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4.5">
								<rect x="4" y="4.5" width="16" height="11" rx="1.5" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.5 19.5h19" />
							</svg>
						{/if}
					</span>
					<div class="min-w-0 flex-1">
						<p class="flex items-center gap-1.5 truncate text-sm text-gray-900 dark:text-gray-100">
							{session.label}
							{#if session.current}
								<span
									class="rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-400"
								>
									This device
								</span>
							{/if}
						</p>
						<p class="truncate text-xs text-gray-400">Last active {lastActive(session)}</p>
					</div>
					{#if !session.current}
						<button
							class="shrink-0 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
							disabled={revokingId === session.id}
							onclick={() => revoke(session.id)}
						>
							{revokingId === session.id ? 'Signing out…' : 'Sign out'}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}
