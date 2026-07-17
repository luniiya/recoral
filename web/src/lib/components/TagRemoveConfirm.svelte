<script lang="ts">
	import Dialog from './Dialog.svelte';

	interface Props {
		label: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { label, onconfirm, oncancel }: Props = $props();
</script>

<Dialog onclose={oncancel}>
	<p class="mb-4 text-sm text-gray-900 dark:text-gray-100">
		Remove <span class="font-semibold">{label}</span> from this recording?
	</p>
	<div class="flex gap-2">
		<button
			class="flex-1 rounded-full px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"
			onclick={oncancel}
		>
			Cancel
		</button>
		<button
			class="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
			onclick={onconfirm}
		>
			Remove
		</button>
	</div>
</Dialog>
