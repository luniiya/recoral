<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { applyAccentHue, cacheAccentHue } from '$lib/accent';
	import { auth } from '$lib/auth.svelte';
	import { bootLog } from '$lib/bootLog';
	import LogoWordmark from '$lib/components/LogoWordmark.svelte';
	import { mobileBack } from '$lib/mobileBack.svelte';
	import { onboarding } from '$lib/onboarding.svelte';
	import { outboxStore } from '$lib/outbox.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { realtimeStore } from '$lib/realtime.svelte';
	import { syncStore } from '$lib/sync.svelte';
	import { systemAccentStore } from '$lib/systemAccent.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { vimMode } from '$lib/vimMode.svelte';
	import { wavySeekStore } from '$lib/wavySeek.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	bootLog('root layout: module evaluated, native =', isNativePlatform(), 'onboarding.mode =', onboarding.mode);

	// Mobile only: before anything else loads, make sure a server is picked
	// (or "go offline" was chosen) at least once. Desktop webUI always talks
	// to its own origin, so there's nothing to pick, this never fires there.
	$effect(() => {
		if (!isNativePlatform()) return;
		if (onboarding.mode === null && page.url.pathname !== '/setup') {
			bootLog('root layout: no onboarding mode yet, redirecting to /setup');
			goto('/setup');
		} else if (onboarding.mode === 'offline' && page.url.pathname !== '/setup/offline') {
			bootLog('root layout: offline mode, redirecting to /setup/offline');
			goto('/setup/offline');
		}
	});

	// There's no server to ask yet until onboarding picks one (mobile only,
	// always true immediately on desktop), so don't fire this too early, it'd
	// just hit a URL that doesn't exist and throw parsing the response.
	$effect(() => {
		if (isNativePlatform() && onboarding.mode === null) {
			bootLog('root layout: skipping auth refresh, no server picked yet');
			auth.skipRefresh();
			return;
		}
		bootLog('root layout: calling auth.refresh()');
		auth.refresh();
	});

	// Diagnostic only, see bootLog.ts: marks exactly when the top-level
	// "Loading…" screen below actually clears, so its duration is visible
	// alongside the auth.refresh()/tags/recordings timings logged elsewhere.
	$effect(() => {
		bootLog('root layout: auth.loading =', auth.loading);
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
		bootLog('root layout: onMount fired');
		themeStore.init();
		wavySeekStore.init();

		// Trackpad pinch and ctrl+scroll both fire as a 'wheel' event with
		// ctrlKey set (that's how Chrome/Firefox represent pinch-zoom on a
		// trackpad, there's no separate gesture event for it outside Safari),
		// blocking that stops desktop browser zoom the same way touch-action
		// stops it on mobile. Safari also fires legacy gesture events for
		// actual pinch, not wheel, so that's blocked separately below.
		//
		// Only applies to the native app and an installed PWA (both feel like
		// "an app", zooming is jarring, matches native mobile's touch-action
		// zoom block), not a plain desktop browser tab: there, zooming is
		// completely normal browser behavior a user might genuinely want, and
		// blocking it there was the actual bug, this whole block used to fire
		// unconditionally everywhere with no exception for that case.
		const shouldBlockZoom = isNativePlatform() || window.matchMedia('(display-mode: standalone)').matches;
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey && shouldBlockZoom) event.preventDefault();
		};
		window.addEventListener('wheel', onWheel, { passive: false });
		if (shouldBlockZoom) {
			const onGesture = (event: Event) => event.preventDefault();
			window.addEventListener('gesturestart', onGesture);
			window.addEventListener('gesturechange', onGesture);
		}

		// -webkit-touch-callout:none (app.css) only stops iOS Safari's own
		// long-press callout. On Android/Chrome (which is what the plain mobile
		// web version runs in, unlike the Capacitor APK's WebView, which never
		// hit this) a long enough touch-and-hold fires a real 'contextmenu'
		// event instead, popping the browser's right-click-style menu right on
		// top of RecordingCard's own hold-to-select gesture. Same "native-
		// feeling app, not a document" reasoning as the touch-callout rule:
		// blocked on touch, everywhere except text inputs (still need it there
		// for copy/paste). A real desktop right-click is a completely normal,
		// wanted thing (e.g. right-click-copy on the now-selectable transcript
		// text) and must not be swallowed too: 'contextmenu' itself can't tell
		// touch from mouse directly, so the most recent pointer type is tracked
		// via 'pointerdown' instead. This used to block unconditionally,
		// killing right-click everywhere on desktop, confirmed a real bug.
		let lastPointerWasTouch = false;
		window.addEventListener(
			'pointerdown',
			(event: PointerEvent) => {
				lastPointerWasTouch = event.pointerType !== 'mouse';
			},
			{ capture: true }
		);
		const onContextMenu = (event: MouseEvent) => {
			if (!lastPointerWasTouch) return;
			const target = event.target as HTMLElement;
			if (target.closest('input, textarea, [contenteditable]')) return;
			event.preventDefault();
		};
		window.addEventListener('contextmenu', onContextMenu);

		// See vimMode.svelte.ts: gates the j/k/l/h list-navigation shortcuts
		// (and drives their little NORMAL/INSERT status indicator) so they
		// never fire while actually typing into a title/description/search.
		function onFocusIn(event: FocusEvent) {
			vimMode.set(!!(event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]'));
		}
		function onFocusOut() {
			vimMode.set(false);
		}
		window.addEventListener('focusin', onFocusIn);
		window.addEventListener('focusout', onFocusOut);

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
	<!-- Only reached on a genuine first-ever login on this device/browser
	     (no cached user to show meanwhile), and bounded to ~8s by
	     auth.refresh()'s own request timeout, not an indefinite spinner. -->
	<div class="flex min-h-dvh items-center justify-center bg-white dark:bg-black">
		<div class="animate-pulse">
			<LogoWordmark size="size-10" textSize="text-xl" colored />
		</div>
	</div>
{:else}
	{@render children()}
{/if}
