<script lang="ts">
	import '../app.css';
	import { authStore } from '$lib/stores/auth';
	import SyncStatus from '$components/shared/SyncStatus.svelte';
	import ErrorBoundary from '$components/shared/ErrorBoundary.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<nav class="border-b border-gray-800 bg-gray-900">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center gap-8">
					<a href="/" class="text-xl font-bold text-green-400">Spotify Helper</a>
					<div class="flex gap-4">
						<a
							href="/search"
							class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
						>
							Search
						</a>
						<a
							href="/analytics"
							class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
						>
							Analytics
						</a>
					</div>
				</div>

				<div class="flex items-center gap-4">
					{#if $authStore.isAuthenticated}
						<SyncStatus />
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<ErrorBoundary>
			{@render children()}
		</ErrorBoundary>
	</main>
</div>
