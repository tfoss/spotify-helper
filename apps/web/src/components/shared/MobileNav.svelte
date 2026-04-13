<script lang="ts">
	import { page } from '$app/stores';

	export let open = false;
	export let onClose: () => void = () => {};

	$: currentPath = $page.url.pathname;

	function isActive(path: string): boolean {
		if (path === '/') return currentPath === '/';
		return currentPath.startsWith(path);
	}

	function navTo() {
		onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="fixed inset-0 z-40 bg-black/50 md:hidden" on:click={onClose}>
		<div
			class="absolute left-0 top-0 h-full w-64 bg-gray-900 shadow-xl"
			on:click|stopPropagation
		>
			<div class="flex h-16 items-center justify-between border-b border-gray-800 px-4">
				<span class="text-lg font-bold text-green-400">Spotify Helper</span>
				<button on:click={onClose} class="text-gray-400 hover:text-white">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<nav class="flex flex-col gap-1 p-4">
				<a
					href="/"
					on:click={navTo}
					class="rounded-lg px-3 py-2.5 text-sm font-medium {isActive('/') ? 'bg-gray-800 text-green-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
				>
					Home
				</a>
				<a
					href="/search"
					on:click={navTo}
					class="rounded-lg px-3 py-2.5 text-sm font-medium {isActive('/search') ? 'bg-gray-800 text-green-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
				>
					Search
				</a>
				<a
					href="/analytics"
					on:click={navTo}
					class="rounded-lg px-3 py-2.5 text-sm font-medium {isActive('/analytics') ? 'bg-gray-800 text-green-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
				>
					Analytics
				</a>
				<a
					href="/orphaned"
					on:click={navTo}
					class="rounded-lg px-3 py-2.5 text-sm font-medium {isActive('/orphaned') ? 'bg-gray-800 text-green-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
				>
					Orphaned
				</a>
			</nav>

			<div class="absolute bottom-0 left-0 right-0 border-t border-gray-800 p-4">
				<p class="text-xs text-gray-500">Press <kbd class="rounded bg-gray-700 px-1 py-0.5 text-gray-400">⌘K</kbd> to search</p>
			</div>
		</div>
	</div>
{/if}
