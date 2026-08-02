<script lang="ts">
	import { validatePassword } from '@recoral/shared';

	interface Props {
		password: string;
		// Settings.requireStrongPasswords: nothing to show at all if the admin
		// has relaxed this server-wide, any password is accepted either way.
		requireStrong: boolean;
	}

	let { password, requireStrong }: Props = $props();

	// Same shared check the server actually enforces (server/src/auth.ts calls
	// this exact function), so this hint can never drift out of sync with
	// what submitting the form will actually accept.
	let check = $derived(validatePassword(password, requireStrong));
</script>

<!-- Same visual language as PasswordMatchHint right next to it: without this,
     "Passwords match" was the only feedback on screen, so a weak-but-matching
     password looked completely fine right up until a surprise error on
     submit, with no earlier indication a complexity rule even existed. -->
{#if requireStrong && password}
	{#if check.valid}
		<p class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4.5 4.5L19 7.5" />
			</svg>
			Meets password requirements
		</p>
	{:else}
		<p class="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
			</svg>
			{check.reason}
		</p>
	{/if}
{/if}
