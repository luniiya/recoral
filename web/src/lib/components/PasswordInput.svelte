<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		value: string;
		id?: string;
		placeholder?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		minlength?: number;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		inputClass?: string;
	}

	let {
		value = $bindable(''),
		id,
		placeholder,
		autocomplete,
		minlength,
		required,
		disabled,
		class: wrapperClass = '',
		inputClass = 'form-input'
	}: Props = $props();

	let visible = $state(false);
</script>

<div class="relative {wrapperClass}">
	<input
		{id}
		type={visible ? 'text' : 'password'}
		bind:value
		{placeholder}
		{autocomplete}
		{minlength}
		{required}
		{disabled}
		class="{inputClass} pr-10"
	/>
	<button
		type="button"
		tabindex="-1"
		class="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
		onclick={() => (visible = !visible)}
		aria-label={visible ? 'Hide password' : 'Show password'}
	>
		{#if visible}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.5 3.5l17 17M10.6 10.7a2.5 2.5 0 0 0 3.6 3.5M7.4 7.2C5.4 8.5 3.9 10.4 3 12c1.6 2.9 4.9 6.5 9 6.5 1.5 0 2.9-.5 4.1-1.2M12 5.5c4.1 0 7.4 3.6 9 6.5-.5.9-1.2 1.9-2.1 2.9"
				/>
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 12c1.6-2.9 4.9-6.5 9-6.5s7.4 3.6 9 6.5c-1.6 2.9-4.9 6.5-9 6.5S4.6 14.9 3 12Z"
				/>
				<circle cx="12" cy="12" r="2.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{/if}
	</button>
</div>
