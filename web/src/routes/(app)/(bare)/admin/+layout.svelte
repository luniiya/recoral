<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import AdminNav from '$lib/components/AdminNav.svelte';
	import BackButton from '$lib/components/BackButton.svelte';

	let { children } = $props();
</script>

{#if !auth.loading && auth.user && !auth.user.isAdmin}
	<div class="flex min-h-0 flex-1 flex-col px-6 pt-6">
		<div class="mb-6 flex items-center gap-3">
			<BackButton mobileHref="/account" desktopHref="/" label="Back" />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Administration</h1>
		</div>
		<div class="card p-8 text-center text-sm text-gray-400">You don't have access to this page.</div>
	</div>
{:else if !auth.loading}
	<div class="flex min-h-0 flex-1 flex-col md:flex-row">
		<AdminNav />
		<main class="min-h-0 flex-1 overflow-y-auto">
			<div class="mx-auto w-full max-w-xl px-6 pt-6 pb-24 md:pt-10 md:pb-10">
				<div class="mb-6 flex items-center gap-3">
					<BackButton mobileHref="/account" desktopHref="/" label="Back" />
					<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Administration</h1>
				</div>
				{@render children()}
			</div>
		</main>
	</div>
{/if}
