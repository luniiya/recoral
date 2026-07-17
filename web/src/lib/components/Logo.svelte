<script lang="ts">
	interface Props {
		size?: string;
	}

	let { size = 'size-7' }: Props = $props();
</script>

<span class="logo-mark {size} shrink-0" role="img" aria-label="recoral"></span>
