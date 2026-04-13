<script lang="ts">
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { search } from '$lib/stores/search';
	import { dbStore } from '$lib/stores/db';
	import { syncStore } from '$lib/stores/sync';
	import { authStore } from '$lib/stores/auth';
	import { SpotifyClient } from '$lib/spotify/client';
	import { getSavedSearches, saveSearch, removeSavedSearch } from '$lib/search/saved';
	import type { SavedSearch } from '$lib/search/saved';
	import SearchResults from '../../components/search/SearchResults.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import ErrorMessage from '$components/shared/ErrorMessage.svelte';

	let query = $state('');
	let trackQuery = $state('');
	let artistQuery = $state('');
	let refined = $state(false);
	let fuzzyMode = $state(false);
	let playlistCount = $state<number | null>(null);
	let checkingDb = $state(true);

	// Saved searches
	let savedSearches = $state<SavedSearch[]>(getSavedSearches());
	let saveNameInput = $state('');
	let showSaveInput = $state(false);

	let dbReady = $derived($dbStore.isReady);
	let dbInitializing = $derived($dbStore.isInitializing);
	let dbError = $derived($dbStore.error);
	let hasPlaylists = $derived(playlistCount !== null && playlistCount > 0);

	/** True when there is a non-empty active query. */
	let hasActiveQuery = $derived(
		refined ? (trackQuery.trim().length > 0 || artistQuery.trim().length > 0) : query.trim().length > 0
	);

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

	/** Build and push a URL that encodes the current search state. */
	function syncUrl() {
		const params = new URLSearchParams();
		const q = refined ? trackQuery : query;
		if (q.trim()) params.set('q', q.trim());
		if (refined && artistQuery.trim()) params.set('artist', artistQuery.trim());
		if (refined) params.set('refined', '1');
		if (fuzzyMode) params.set('fuzzy', '1');

		const next = params.toString() ? `?${params.toString()}` : '/search';
		goto(next, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleUnifiedSearch() {
		const { executor } = get(dbStore);
		if (!executor) return;
		search.performSearch({ query, mode: 'unified', fuzzy: fuzzyMode }, executor);
		syncUrl();
	}

	function handleRefinedSearch() {
		const { executor } = get(dbStore);
		if (!executor) return;
		search.performSearch(
			{ query: trackQuery, mode: 'both', artistQuery: artistQuery || undefined, fuzzy: fuzzyMode },
			executor,
		);
		syncUrl();
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
		syncUrl();
	}

	function toggleFuzzy() {
		fuzzyMode = !fuzzyMode;
		handleInput();
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

	/** Save the current search state under a user-chosen name. */
	function handleSaveSearch() {
		if (!hasActiveQuery) return;
		showSaveInput = true;
	}

	function commitSaveSearch() {
		savedSearches = saveSearch(saveNameInput || (refined ? trackQuery : query), {
			query: refined ? trackQuery : query,
			artistQuery: refined ? artistQuery : '',
			refined,
			fuzzy: fuzzyMode
		});
		saveNameInput = '';
		showSaveInput = false;
	}

	function cancelSaveSearch() {
		saveNameInput = '';
		showSaveInput = false;
	}

	/** Apply a saved search: restore state and trigger search. */
	function applySavedSearch(s: SavedSearch) {
		refined = s.refined;
		fuzzyMode = s.fuzzy;
		if (s.refined) {
			trackQuery = s.query;
			artistQuery = s.artistQuery;
			query = '';
		} else {
			query = s.query;
			trackQuery = '';
			artistQuery = '';
		}
		handleInput();
	}

	function handleRemoveSaved(id: string) {
		savedSearches = removeSavedSearch(id);
	}

	/** Initialise state from URL params on page load (or URL change). */
	function initFromUrl(url: URL) {
		const q = url.searchParams.get('q') ?? '';
		const artist = url.searchParams.get('artist') ?? '';
		const isRefined = url.searchParams.get('refined') === '1';
		const isFuzzy = url.searchParams.get('fuzzy') === '1';

		fuzzyMode = isFuzzy;
		refined = isRefined;

		if (isRefined) {
			trackQuery = q;
			artistQuery = artist;
			query = '';
		} else {
			query = q;
			trackQuery = '';
			artistQuery = '';
		}
	}

	// On first load, hydrate state from URL then auto-execute if there's a query.
	$effect(() => {
		const url = $page.url;
		initFromUrl(url);

		if (url.searchParams.get('q')) {
			// Wait for DB to be ready before auto-searching.
			if (dbReady) handleInput();
		}
	});

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

		<div class="flex items-center gap-4">
			<button
				onclick={toggleRefine}
				class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
			>
				{refined ? '← Back to unified search' : 'Refine search (track + artist)'}
			</button>
			<button
				onclick={toggleFuzzy}
				class="flex items-center gap-1.5 text-xs transition-colors {fuzzyMode ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-300'}"
				title="Fuzzy match: finds results even with typos"
			>
				<span class="inline-block h-2 w-2 rounded-full {fuzzyMode ? 'bg-green-400' : 'bg-gray-600'}"></span>
				Fuzzy match {fuzzyMode ? '(on)' : '(off)'}
			</button>

			{#if hasActiveQuery}
				<button
					onclick={handleSaveSearch}
					class="ml-auto text-xs text-gray-500 hover:text-green-400 transition-colors"
					title="Save this search"
				>
					+ Save search
				</button>
			{/if}
		</div>

		<!-- Save search inline form -->
		{#if showSaveInput}
			<div class="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 ring-1 ring-gray-700">
				<input
					bind:value={saveNameInput}
					type="text"
					placeholder="Name this search…"
					class="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
					onkeydown={(e) => { if (e.key === 'Enter') commitSaveSearch(); if (e.key === 'Escape') cancelSaveSearch(); }}
				/>
				<button
					onclick={commitSaveSearch}
					class="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500"
				>
					Save
				</button>
				<button
					onclick={cancelSaveSearch}
					class="text-xs text-gray-500 hover:text-gray-300"
				>
					Cancel
				</button>
			</div>
		{/if}

		<!-- Saved search chips -->
		{#if savedSearches.length > 0}
			<div class="flex flex-wrap gap-2 pt-1">
				{#each savedSearches as s (s.id)}
					<div class="group flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 ring-1 ring-gray-700">
						<button
							onclick={() => applySavedSearch(s)}
							class="text-xs text-gray-300 hover:text-white transition-colors"
							title="Apply saved search: {s.name}"
						>
							{s.name}
						</button>
						<button
							onclick={() => handleRemoveSaved(s.id)}
							class="ml-1 hidden text-xs text-gray-600 hover:text-red-400 group-hover:inline transition-colors"
							title="Remove saved search"
						>
							×
						</button>
					</div>
				{/each}
			</div>
		{/if}
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
