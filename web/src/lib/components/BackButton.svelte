<script lang="ts">
	let {
		href,
		mobileHref,
		desktopHref,
		onclick,
		label = 'Back'
	}: {
		href?: string;
		mobileHref?: string;
		desktopHref?: string;
		onclick?: () => void;
		label?: string;
	} = $props();

	const linkClass =
		'flex size-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5';
</script>

{#snippet arrow()}
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4">
		<path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
	</svg>
{/snippet}

{#if mobileHref && desktopHref}
	<!-- Account/Library are mobile-only landing pages (bottom nav), the sidebar
	     covers their job on desktop, so "back" needs a different destination
	     per breakpoint rather than one hardcoded href. -->
	<a href={mobileHref} class="{linkClass} md:hidden" aria-label={label}>{@render arrow()}</a>
	<a href={desktopHref} class="{linkClass} hidden md:flex" aria-label={label}>{@render arrow()}</a>
{:else if href}
	<a {href} class={linkClass} aria-label={label}>{@render arrow()}</a>
{:else}
	<button type="button" {onclick} class={linkClass} aria-label={label}>{@render arrow()}</button>
{/if}
