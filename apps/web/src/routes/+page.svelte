<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let initializing = $state(true);
	let showWipeConfirm = $state(false);

	onMount(async () => {
		await authStore.initialize();
		initializing = false;
	});

	function handleLogout() {
		authStore.logout();
		goto('/');
	}

	function handleWipeAndLogout() {
		authStore.logout();
		showWipeConfirm = false;
		goto('/');
	}
</script>

<div class="flex flex-col items-center justify-center py-20">
	<h1 class="mb-4 text-4xl font-bold text-green-400">Spotify Helper</h1>
	<p class="mb-8 text-lg text-gray-400">
		Search, analyze, and explore your Spotify library.
	</p>

	{#if initializing}
		<div class="flex items-center gap-3">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<span class="text-gray-400">Checking authentication...</span>
		</div>
	{:else if $authStore.isAuthenticated}
		<div class="flex gap-4">
			<a
				href="/search"
				class="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
			>
				Search
			</a>
			<a
				href="/analytics"
				class="rounded-lg border border-gray-600 px-6 py-3 font-medium text-gray-300 hover:border-gray-400 hover:text-white"
			>
				Analytics
			</a>
			<button
				onclick={handleLogout}
				class="rounded-lg border border-gray-600 px-6 py-3 font-medium text-gray-300 hover:border-gray-400 hover:text-white"
			>
				Log out
			</button>
		</div>

		<button
			onclick={() => (showWipeConfirm = true)}
			class="mt-4 text-xs text-gray-600 hover:text-gray-400"
		>
			Log out &amp; clear local data
		</button>

		{#if showWipeConfirm}
			<div class="mt-3 rounded-lg border border-red-800 bg-red-950/50 p-4 text-center">
				<p class="text-sm text-red-400">This will delete all cached data. Continue?</p>
				<div class="mt-3 flex justify-center gap-3">
					<button
						onclick={handleWipeAndLogout}
						class="rounded bg-red-700 px-4 py-1.5 text-sm text-white hover:bg-red-600"
					>
						Yes, clear everything
					</button>
					<button
						onclick={() => (showWipeConfirm = false)}
						class="rounded bg-gray-800 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<button
			onclick={() => authStore.login()}
			class="flex items-center gap-3 rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white hover:bg-green-500"
		>
			<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
			</svg>
			Connect with Spotify
		</button>

		{#if $authStore.error}
			<p class="mt-4 text-sm text-red-400">{$authStore.error}</p>
		{/if}
	{/if}
</div>
