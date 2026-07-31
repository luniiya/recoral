<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		message: Snippet;
		confirmLabel: string;
		cancelLabel?: string;
		// Red for anything destructive/irreversible (delete, trash), the app's
		// own accent color otherwise (still a real confirm, just not a "you
		// might lose this forever" one), matching the rest of the app's
		// red-means-destructive convention.
		danger?: boolean;
		onconfirm: () => void;
		onclose: () => void;
	}

	let { message, confirmLabel, cancelLabel = 'Cancel', danger = false, onconfirm, onclose }: Props = $props();
</script>

<!-- Shared "are you sure?" popup: a message plus a Cancel/confirm button
     pair, the same shape this app already repeats for every destructive or
     semi-destructive action (delete, trash, retranscribe, bulk delete).
     Wraps the generic Dialog shell, not a replacement for it, Dialog is
     still the right choice directly for anything that isn't this exact
     confirm/cancel shape (FilterPanel, TagRemoveConfirm's richer content). -->
<Dialog {onclose}>
	<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
		{@render message()}
	</p>
	<div class="flex gap-2">
		<button
			class="flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
			onclick={onclose}
		>
			{cancelLabel}
		</button>
		<button
			class="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white transition
				{danger ? 'bg-red-600 hover:bg-red-700' : 'bg-accent-500 hover:bg-accent-600'}"
			onclick={onconfirm}
		>
			{confirmLabel}
		</button>
	</div>
</Dialog>
