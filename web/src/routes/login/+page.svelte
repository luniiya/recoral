<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	$effect(() => {
		if (auth.user) goto('/');
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		submitting = true;
		try {
			if (mode === 'login') await auth.login(email, password);
			else await auth.register(email, password);
			goto('/');
		} catch (err) {
			error = (err as Error).message;
		} finally {
			submitting = false;
		}
	}
</script>

<section class="relative flex min-h-dvh items-center justify-center bg-gray-50 px-4 dark:bg-neutral-950">
	<div class="absolute top-4 right-4">
		<ThemeToggle />
	</div>

	<div class="card w-full max-w-sm p-8">
		<div class="mb-8 flex flex-col items-center gap-2">
			<img src="/logo.png" alt="recoral" class="size-12 rounded-full object-cover" />
			<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
				{mode === 'login' ? 'Log in to recoral' : 'Create your recoral account'}
			</h1>
		</div>

		<form onsubmit={submit} class="flex flex-col gap-4">
			{#if error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
					{error}
				</p>
			{/if}

			<label class="flex flex-col gap-1.5">
				<span class="form-label">Email</span>
				<input
					class="form-input"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
				/>
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="form-label">Password</span>
				<input
					class="form-input"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</label>

			<button
				type="submit"
				disabled={submitting}
				class="mt-2 rounded-full bg-coral-500 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-600 disabled:opacity-60"
			>
				{mode === 'login' ? 'Log in' : 'Create account'}
			</button>
		</form>

		<button
			type="button"
			class="mt-6 w-full text-center text-sm text-coral-600 hover:underline dark:text-coral-400"
			onclick={() => (mode = mode === 'login' ? 'register' : 'login')}
		>
			{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
		</button>
	</div>
</section>
