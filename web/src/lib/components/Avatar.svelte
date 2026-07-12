<script lang="ts">
	interface Props {
		name: string;
		avatar: string | null;
		size?: string;
	}

	let { name, avatar, size = 'size-8' }: Props = $props();
</script>

<div class="{size} shrink-0 overflow-hidden rounded-full bg-accent-500 text-white">
	{#if avatar}
		<img src={avatar} alt={name} class="size-full object-cover" />
	{:else}
		<span class="flex size-full items-center justify-center font-medium uppercase">
			{name[0] ?? '?'}
		</span>
	{/if}
</div>
