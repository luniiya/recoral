<script lang="ts">
	let {
		value,
		label,
		tone = 'accent'
	}: { value: string | number; label: string; tone?: 'accent' | 'gray' } = $props();
</script>

<div class="rounded-xl p-4 text-center {tone === 'accent' ? 'bg-accent-50 dark:bg-accent-500/10' : 'bg-gray-50 dark:bg-white/5'}">
	<p
		class="text-2xl font-semibold {tone === 'accent'
			? 'text-accent-600 dark:text-accent-400'
			: 'text-gray-500 dark:text-gray-400'}"
	>
		{value}
	</p>
	<p class="text-xs text-gray-500 dark:text-gray-400">{label}</p>
</div>
