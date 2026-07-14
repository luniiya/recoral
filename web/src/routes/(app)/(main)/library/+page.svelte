<script lang="ts">
	import { navIcons } from '$lib/navIcons';

	const items = [
		{ href: '/tags', label: 'Tags', description: 'Browse recordings by tag', ...navIcons.tags },
		{ href: '/archive', label: 'Archive', description: 'Recordings you’ve tucked away', ...navIcons.archive },
		{ href: '/bin', label: 'Bin', description: 'Deleted for good after 30 days', ...navIcons.bin }
	];
</script>

<svelte:head>
	<title>recoral - Library</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 pt-10 pb-36 md:pb-10">
	<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Library</h1>

	<div class="flex flex-col gap-3">
		{#each items as item (item.href)}
			<a href={item.href} class="card flex w-full items-center gap-4 p-4 transition hover:bg-gray-50 dark:hover:bg-white/5">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400"
				>
					<svg
						viewBox="0 0 24 24"
						fill={item.stroke ? 'none' : 'currentColor'}
						stroke={item.stroke ? 'currentColor' : 'none'}
						stroke-width={item.stroke ? '1.8' : '0'}
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-5"
					>
						<path d={item.path} />
					</svg>
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
				</div>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4 shrink-0 text-gray-300 dark:text-gray-600">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
				</svg>
			</a>
		{/each}
	</div>
</div>
