<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import CommandPalette from '../components/search/CommandPalette.svelte';
	import MobileNav from '../components/shared/MobileNav.svelte';

	let { children } = $props();

	let mobileMenuOpen = $state(false);

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

<div class="min-h-screen bg-gray-950 text-white">
	<nav class="border-b border-gray-800 bg-gray-900">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center gap-4 sm:gap-8">
					<!-- Hamburger button (mobile only) -->
					<button
						class="text-gray-400 hover:text-white md:hidden"
						onclick={toggleMobileMenu}
						aria-label="Open menu"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>

					<a href="/" class="text-xl font-bold text-green-400">Spotify Helper</a>

					<!-- Desktop nav links -->
					<div class="hidden gap-1 md:flex">
						<a
							href="/search"
							class="rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive('/search')
								? 'bg-gray-800 text-green-400'
								: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
						>
							Search
						</a>
						<a
							href="/analytics"
							class="rounded-md px-3 py-2 text-sm font-medium transition-colors {isActive('/analytics')
								? 'bg-gray-800 text-green-400'
								: 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
						>
							Analytics
						</a>
					</div>
				</div>

				<!-- CMD+K hint (desktop only) -->
				<div class="hidden items-center gap-2 md:flex">
					<kbd class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-400">⌘K</kbd>
					<span class="text-xs text-gray-500">Search</span>
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
		{@render children()}
	</main>
</div>

<!-- Global command palette (available on all pages) -->
<CommandPalette />

<!-- Mobile navigation drawer -->
<MobileNav open={mobileMenuOpen} onClose={closeMobileMenu} />
