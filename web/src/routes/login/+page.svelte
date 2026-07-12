<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';

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

<main>
	<h1>recoral</h1>

	<form onsubmit={submit}>
		<label>
			Email
			<input type="email" bind:value={email} required autocomplete="email" />
		</label>
		<label>
			Password
			<input type="password" bind:value={password} required autocomplete="current-password" />
		</label>

		{#if error}<p class="error">{error}</p>{/if}

		<button type="submit" disabled={submitting}>
			{mode === 'login' ? 'Log in' : 'Create account'}
		</button>
	</form>

	<button
		class="switch"
		type="button"
		onclick={() => (mode = mode === 'login' ? 'register' : 'login')}
	>
		{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
	</button>
</main>

<style>
	main {
		max-width: 22rem;
		margin: 4rem auto;
		padding: 0 1.5rem;
		font-family: system-ui, sans-serif;
		color: #3a2e2a;
	}

	h1 {
		text-align: center;
		color: #ff7f5e;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: #fff;
		border: 1px solid #ffe1d6;
		border-radius: 0.75rem;
		padding: 1.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: #8a746c;
	}

	input {
		padding: 0.5rem 0.65rem;
		border: 1px solid #ffe1d6;
		border-radius: 0.5rem;
		font-size: 1rem;
	}

	button[type='submit'] {
		margin-top: 0.25rem;
		padding: 0.6rem;
		border: none;
		border-radius: 0.5rem;
		background: #ff7f5e;
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	button[type='submit']:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.switch {
		display: block;
		margin: 1rem auto 0;
		background: none;
		border: none;
		color: #ff7f5e;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.error {
		color: #e8483a;
		font-size: 0.85rem;
		margin: 0;
	}
</style>
