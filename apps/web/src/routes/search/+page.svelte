<script lang="ts">
	import { get } from 'svelte/store';
	import { search } from '$lib/stores/search';
	import { dbStore } from '$lib/stores/db';
	import SearchResults from '../../components/search/SearchResults.svelte';
	import type { SearchMode } from '$lib/search/types';

	let query = '';
	let mode: SearchMode = 'track';
	let artistQuery = '';

	function handleInput() {
		const { executor } = get(dbStore);
		if (!executor) return;
		search.performSearch({ query, mode, artistQuery: mode === 'both' ? artistQuery : undefined }, executor);
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="mb-6 text-3xl font-bold text-white">Search Playlists</h1>

	<div class="mb-4 space-y-3">
		<div class="flex gap-2">
			<input
				bind:value={query}
				oninput={handleInput}
				type="text"
				placeholder={mode === 'artist' ? 'Artist name...' : 'Track name...'}
				class="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
			/>
			<select
				bind:value={mode}
				onchange={handleInput}
				class="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 outline-none ring-1 ring-gray-700"
			>
				<option value="track">Track</option>
				<option value="artist">Artist</option>
				<option value="both">Both</option>
			</select>
		</div>

		{#if mode === 'both'}
			<input
				bind:value={artistQuery}
				oninput={handleInput}
				type="text"
				placeholder="Artist name..."
				class="w-full rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
			/>
		{/if}
	</div>

	<!-- Loading state -->
	{#if $search.isSearching}
		<div class="flex items-center justify-center py-10">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<span class="ml-3 text-gray-400">Searching...</span>
		</div>
	{:else if $search.error}
		<!-- Error state -->
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
			/>
		{:else if query.trim()}
			<!-- Empty state after search -->
			<div class="py-10 text-center">
				<p class="text-gray-500">No results found for "{query}"</p>
				<p class="mt-2 text-sm text-gray-600">Try a different search term or mode.</p>
			</div>
		{/if}
	{:else if !query.trim()}
		<!-- Initial empty state -->
		<div class="py-10 text-center text-gray-600">
			<p>Start typing to search your synced playlists.</p>
		</div>
	{/if}
</div>
