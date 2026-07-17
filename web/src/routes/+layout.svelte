<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { applyAccentHue, cacheAccentHue } from '$lib/accent';
	import { auth } from '$lib/auth.svelte';
	import { mobileBack } from '$lib/mobileBack.svelte';
	import { onboarding } from '$lib/onboarding.svelte';
	import { outboxStore } from '$lib/outbox.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { realtimeStore } from '$lib/realtime.svelte';
	import { syncStore } from '$lib/sync.svelte';
	import { systemAccentStore } from '$lib/systemAccent.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { wavySeekStore } from '$lib/wavySeek.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Mobile only: before anything else loads, make sure a server is picked
	// (or "go offline" was chosen) at least once. Desktop webUI always talks
	// to its own origin, so there's nothing to pick, this never fires there.
	$effect(() => {
		if (!isNativePlatform()) return;
		if (onboarding.mode === null && page.url.pathname !== '/setup') {
			goto('/setup');
		} else if (onboarding.mode === 'offline' && page.url.pathname !== '/setup/offline') {
			goto('/setup/offline');
		}
	});

	// There's no server to ask yet until onboarding picks one (mobile only,
	// always true immediately on desktop), so don't fire this too early, it'd
	// just hit a URL that doesn't exist and throw parsing the response.
	$effect(() => {
		if (isNativePlatform() && onboarding.mode === null) {
			auth.skipRefresh();
			return;
		}
		auth.refresh();
	});

	// Once logged in, try to push anything left over in the local outbox
	// (queued while offline, or from a previous session that never got a
	// chance to sync). syncStore.init() also sets up the online/foreground
	// triggers for future flushes, so this only needs to fire once.
	$effect(() => {
		if (isNativePlatform() && auth.user) syncStore.init();
	});

	// Cross-device live updates: connect once logged in (desktop and mobile
	// both, not native-only, since the desktop webUI benefits just as much),
	// disconnect on logout so a stale connection doesn't linger authenticated
	// as nobody.
	$effect(() => {
		if (auth.user) realtimeStore.connect();
		else realtimeStore.disconnect();
	});

	// Single source of truth for the applied accent: re-runs whenever the
	// logged-in user's own accentHue changes OR systemAccentStore's state
	// changes (its async native-plugin fetch resolving, or the Settings
	// toggle flipping), so the Android system color (when available and
	// enabled) can override the per-user color reactively, not just once at
	// login. Priority is system color first, see systemAccent.svelte.ts.
	$effect(() => {
		if (!auth.user) return;
		const hue = systemAccentStore.effectiveHue(auth.user.accentHue);
		applyAccentHue(hue);
		cacheAccentHue(hue);
	});

	onMount(() => {
		themeStore.init();
		wavySeekStore.init();

		// Trackpad pinch and ctrl+scroll both fire as a 'wheel' event with
		// ctrlKey set (that's how Chrome/Firefox represent pinch-zoom on a
		// trackpad, there's no separate gesture event for it outside Safari),
		// blocking that stops desktop browser zoom the same way touch-action
		// stops it on mobile. Safari also fires legacy gesture events for
		// actual pinch, not wheel, so that's blocked separately below.
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey) event.preventDefault();
		};
		window.addEventListener('wheel', onWheel, { passive: false });
		const onGesture = (event: Event) => event.preventDefault();
		window.addEventListener('gesturestart', onGesture);
		window.addEventListener('gesturechange', onGesture);

		if (!isNativePlatform() && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}

		if (isNativePlatform()) void outboxStore.init();
		if (isNativePlatform()) void systemAccentStore.init();

		if (isNativePlatform()) {
			// Registering any listener here replaces Capacitor's default
			// behavior entirely, so we have to reimplement the fallback
			// (history back, else exit) ourselves for the no-open-panel case.
			import('@capacitor/app').then(({ App }) => {
				App.addListener('backButton', ({ canGoBack }) => {
					if (mobileBack.handler) {
						mobileBack.handler();
					} else if (canGoBack) {
						window.history.back();
					} else {
						App.exitApp();
					}
				});
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
</svelte:head>

{#if auth.loading}
	<div class="flex min-h-dvh items-center justify-center text-sm text-gray-400">Loading&hellip;</div>
{:else}
	{@render children()}
{/if}
