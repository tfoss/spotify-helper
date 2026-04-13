<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth';
	import { dbStore } from '$lib/stores/db';
	import { syncStore } from '$lib/stores/sync';
	import { themeStore } from '$lib/stores/theme';
	import { SpotifyClient } from '$lib/spotify/client';
	import { page } from '$app/stores';
	import SyncStatus from '$components/shared/SyncStatus.svelte';
	import ErrorBoundary from '$components/shared/ErrorBoundary.svelte';
	import CommandPalette from '../components/search/CommandPalette.svelte';
	import MobileNav from '../components/shared/MobileNav.svelte';

	let { children } = $props();

	let mobileMenuOpen = $state(false);
	let hasSyncedThisSession = false;

	function createClient(): SpotifyClient {
		return new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken()
		);
	}

	function triggerSync() {
		const auth = get(authStore);
		const db = get(dbStore);
		if (auth.isAuthenticated && db.isReady && db.executor) {
			syncStore.startSync(createClient(), db.executor);
		}
	}

	onMount(() => {
		themeStore.init();
		dbStore.initialize();
	});

	// Auto-sync when both auth and DB are ready
	$effect(() => {
		if ($authStore.isAuthenticated && $dbStore.isReady && !hasSyncedThisSession && !$syncStore.isSyncing) {
			hasSyncedThisSession = true;
			triggerSync();
		}
	});

	function isActive(path: string): boolean {
		const current = $page.url.pathname;
		if (path === '/') return current === '/';
		return current.startsWith(path);
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
	<nav class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center gap-4 sm:gap-8">
					<!-- Hamburger button (mobile only) -->
					<button
						class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:hidden"
						onclick={toggleMobileMenu}
						aria-label="Open menu"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>

					<a href="/" class="text-xl font-bold text-green-500 dark:text-green-400">Spotify Helper</a>

					<!-- Desktop nav links -->
					<div class="hidden gap-1 md:flex">
						<a
							href="/search"
							class="rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive('/search')
								? 'bg-gray-100 text-green-600 dark:bg-gray-800 dark:text-green-400'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}"
						>
							Search
						</a>
						<a
							href="/analytics"
							class="rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive('/analytics')
								? 'bg-gray-100 text-green-600 dark:bg-gray-800 dark:text-green-400'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}"
						>
							Analytics
						</a>
						<a
							href="/orphaned"
							class="rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive('/orphaned')
								? 'bg-gray-100 text-green-600 dark:bg-gray-800 dark:text-green-400'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}"
						>
							Orphaned
						</a>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if $authStore.isAuthenticated}
						<SyncStatus onSync={triggerSync} />
					{/if}
					<!-- CMD+K hint (desktop only) -->
					<div class="hidden items-center gap-2 md:flex">
						<kbd class="rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">⌘K</kbd>
						<span class="text-xs text-gray-400 dark:text-gray-500">Search</span>
					</div>
					<!-- Theme toggle -->
					<button
						onclick={() => themeStore.toggle()}
						class="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
						aria-label="Toggle theme"
						title={$themeStore === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{#if $themeStore === 'dark'}
							<!-- Sun icon: switch to light -->
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
							</svg>
						{:else}
							<!-- Moon icon: switch to dark -->
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
		<ErrorBoundary>
			{@render children()}
		</ErrorBoundary>
	</main>
</div>

<!-- Global command palette (available on all pages) -->
<CommandPalette />

<!-- Mobile navigation drawer -->
<MobileNav open={mobileMenuOpen} onClose={closeMobileMenu} />
