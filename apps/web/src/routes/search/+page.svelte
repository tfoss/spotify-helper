<script lang="ts">
	import { get } from 'svelte/store';
	import { search } from '$lib/stores/search';
	import { dbStore } from '$lib/stores/db';
	import { syncStore } from '$lib/stores/sync';
	import { authStore } from '$lib/stores/auth';
	import { SpotifyClient } from '$lib/spotify/client';
	import SearchResults from '../../components/search/SearchResults.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import ErrorMessage from '$components/shared/ErrorMessage.svelte';

	let query = $state('');
	let trackQuery = $state('');
	let artistQuery = $state('');
	let refined = $state(false);
	let playlistCount = $state<number | null>(null);
	let checkingDb = $state(true);

	let dbReady = $derived($dbStore.isReady);
	let dbInitializing = $derived($dbStore.isInitializing);
	let dbError = $derived($dbStore.error);
	let hasPlaylists = $derived(playlistCount !== null && playlistCount > 0);

	async function checkPlaylistCount() {
		const { executor } = get(dbStore);
		if (!executor) return;
		try {
			const rows = await executor('SELECT COUNT(*) AS n FROM playlists');
			playlistCount = (rows[0]?.n as number) ?? 0;
		} catch {
			playlistCount = 0;
		}
		checkingDb = false;
	}

	function handleUnifiedSearch() {
		const { executor } = get(dbStore);
		if (!executor) return;
		search.performSearch({ query, mode: 'unified' }, executor);
	}

	function handleRefinedSearch() {
		const { executor } = get(dbStore);
		if (!executor) return;
		search.performSearch(
			{ query: trackQuery, mode: 'both', artistQuery: artistQuery || undefined },
			executor,
		);
	}

	function handleInput() {
		if (refined) {
			handleRefinedSearch();
		} else {
			handleUnifiedSearch();
		}
	}

	function toggleRefine() {
		refined = !refined;
		if (refined) {
			trackQuery = query;
			artistQuery = '';
		} else {
			query = trackQuery || artistQuery;
			trackQuery = '';
			artistQuery = '';
		}
		search.clearSearch();
	}

	function getClient(): SpotifyClient | null {
		const state = get(authStore);
		if (!state.isAuthenticated || !state.accessToken) return null;
		return new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken()
		);
	}

	async function handleSync() {
		const client = getClient();
		const { executor } = get(dbStore);
		if (!client || !executor) return;

		await syncStore.startSync(client, executor);
		await checkPlaylistCount();
	}

	$effect(() => {
		if (dbReady) {
			checkPlaylistCount();
		}
	});
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="mb-6 text-3xl font-bold text-white">Search Playlists</h1>

	{#if dbInitializing}
		<div class="flex items-center justify-center gap-3 py-16">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<span class="text-gray-400">Initializing database...</span>
		</div>
	{:else if dbError}
		<ErrorMessage message={dbError} onretry={() => dbStore.initialize()} />
	{:else if !dbReady}
		<EmptyState
			icon="🔌"
			title="Database not ready"
			description="The local database hasn't been initialized yet. This usually resolves automatically."
		/>
	{:else if checkingDb}
		<div class="flex items-center justify-center gap-3 py-10">
			<div class="h-5 w-5 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<span class="text-gray-400">Checking local data...</span>
		</div>
	{:else if !hasPlaylists}
		<div class="py-16 text-center">
			<p class="text-3xl">📋</p>
			<p class="mt-3 text-lg text-gray-400">No playlists synced yet</p>
			<p class="mt-1 text-sm text-gray-600">Sync your Spotify playlists to start searching.</p>
			{#if $authStore.isAuthenticated}
				{#if $syncStore.isSyncing}
					<div class="mt-4 mx-auto max-w-xs space-y-2">
						{#if $syncStore.progress}
							{#if $syncStore.progress.phase === 'fetching_playlists'}
								<div class="flex items-center justify-center gap-2">
									<div class="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
									<span class="text-sm text-gray-400">Fetching playlists...</span>
								</div>
							{:else}
								<p class="text-sm text-gray-400 text-center">
									Syncing playlist {$syncStore.progress.current} of {$syncStore.progress.total}...
								</p>
								<div class="h-2 w-full rounded-full bg-gray-800">
									<div
										class="h-2 rounded-full bg-green-500 transition-all duration-300"
										style="width: {$syncStore.progress.total > 0 ? Math.round(($syncStore.progress.current / $syncStore.progress.total) * 100) : 0}%"
									></div>
								</div>
							{/if}
						{:else}
							<div class="flex items-center justify-center gap-2">
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
								<span class="text-sm text-gray-400">Syncing...</span>
							</div>
						{/if}
					</div>
				{:else}
					<button
						onclick={handleSync}
						class="mt-4 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
					>
						Sync from Spotify
					</button>
				{/if}
				{#if $syncStore.error}
					<p class="mt-2 text-sm text-red-400">{$syncStore.error}</p>
				{/if}
			{:else}
				<a
					href="/"
					class="mt-4 inline-block rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
				>
					Connect Spotify First
				</a>
			{/if}
		</div>
	{:else}
	<div class="mb-4 space-y-3">
		{#if !refined}
			<!-- Unified search bar -->
			<input
				bind:value={query}
				oninput={handleInput}
				type="text"
				placeholder="Search by track name or artist..."
				class="w-full rounded-lg bg-gray-800 px-4 py-3 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
			/>
		{:else}
			<!-- Refined search: separate track + artist fields -->
			<div class="space-y-2">
				<input
					bind:value={trackQuery}
					oninput={handleInput}
					type="text"
					placeholder="Track name..."
					class="w-full rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
				/>
				<input
					bind:value={artistQuery}
					oninput={handleInput}
					type="text"
					placeholder="Artist name..."
					class="w-full rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
				/>
			</div>
		{/if}

		<button
			onclick={toggleRefine}
			class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
		>
			{refined ? '← Back to unified search' : 'Refine search (track + artist)'}
		</button>
	</div>

	<!-- Loading state -->
	{#if $search.isSearching}
		<div class="flex items-center justify-center py-10">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<span class="ml-3 text-gray-400">Searching...</span>
		</div>
	{:else if $search.error}
		<div class="rounded-lg border border-red-800 bg-red-950/50 p-6 text-center">
			<p class="text-red-400">{$search.error}</p>
			<button
				onclick={handleInput}
				class="mt-3 rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
			>
				Retry
			</button>
		</div>
	{:else if $search.results}
		{#if $search.results.totalMatches > 0}
			<p class="mb-3 text-sm text-gray-500">
				Found {$search.results.totalMatches} result{$search.results.totalMatches === 1 ? '' : 's'} in {$search.results.searchTimeMs}ms
			</p>
			<SearchResults
				results={$search.results}
				isSearching={$search.isSearching}
				error={$search.error}
				searchQuery={refined ? trackQuery : query}
			/>
		{:else if (refined ? (trackQuery.trim() || artistQuery.trim()) : query.trim())}
			<div class="py-10 text-center">
				<p class="text-gray-500">No results found</p>
				<p class="mt-2 text-sm text-gray-600">Try a different search term{refined ? ' or switch to unified search' : ''}.</p>
			</div>
		{/if}
	{:else if !(refined ? (trackQuery.trim() || artistQuery.trim()) : query.trim())}
		<div class="py-10 text-center text-gray-600">
			<p>Start typing to search your synced playlists.</p>
			<p class="mt-1 text-sm text-gray-700">{playlistCount} playlist{playlistCount === 1 ? '' : 's'} available</p>
		</div>
	{/if}
	{/if}
</div>
