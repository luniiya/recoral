<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import Tabs from '$lib/components/Tabs.svelte';

	let { children } = $props();

	let activeAdminTab = $derived(
		page.url.pathname === '/admin/transcription'
			? 'transcription'
			: page.url.pathname === '/admin/users'
				? 'users'
				: 'general'
	);

	function onSelectTab(value: string) {
		goto(value === 'general' ? '/admin' : `/admin/${value}`);
	}
</script>

<div class="mb-6 flex items-center gap-3">
	<BackButton mobileHref="/account" desktopHref="/" label="Back" />
	<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Administration</h1>
</div>

{#if !auth.loading && auth.user && !auth.user.isAdmin}
	<div class="card p-8 text-center text-sm text-gray-400">You don't have access to this page.</div>
{:else if !auth.loading}
	<div class="mb-6">
		<Tabs
			tabs={[
				{ value: 'general', label: 'General' },
				{ value: 'transcription', label: 'Transcription' },
				{ value: 'users', label: 'Users' }
			]}
			active={activeAdminTab}
			onselect={onSelectTab}
		/>
	</div>

	{@render children()}
{/if}
