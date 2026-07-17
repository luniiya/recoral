<script lang="ts">
	import Logo from './Logo.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = 'flex items-center gap-2.5' }: Props = $props();
</script>

<a href="/" class={className}>
	<Logo size="size-7" />
	<span class="font-wordmark text-base font-semibold text-gray-900 dark:text-gray-100">recoral</span>
</a>
