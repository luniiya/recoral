<script lang="ts">
	interface Props {
		checked: boolean;
		onchange: (checked: boolean) => void;
		disabled?: boolean;
		label?: string;
	}

	let { checked, onchange, disabled = false, label }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	class="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 {checked
		? 'bg-accent-500'
		: 'bg-gray-300 dark:bg-white/15'}"
	onclick={() => onchange(!checked)}
>
	<span
		class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform"
		class:translate-x-5={checked}
	></span>
</button>
