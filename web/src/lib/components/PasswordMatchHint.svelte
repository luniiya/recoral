<script lang="ts">
	interface Props {
		password: string;
		confirm: string;
	}

	let { password, confirm }: Props = $props();
</script>

{#if confirm}
	{#if password === confirm}
		<p class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4.5 4.5L19 7.5" />
			</svg>
			Passwords match
		</p>
	{:else}
		<p class="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5 shrink-0">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
			</svg>
			Passwords don't match
		</p>
	{/if}
{/if}
