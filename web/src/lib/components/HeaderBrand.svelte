<script lang="ts">
	import LogoWordmark from './LogoWordmark.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = 'flex items-center gap-2.5' }: Props = $props();
</script>

<a href="/" class={className}>
	<LogoWordmark />
</a>
