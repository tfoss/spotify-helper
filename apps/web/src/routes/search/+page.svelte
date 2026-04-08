<script lang="ts">
	import { search } from '$lib/stores/search';
	import SearchResults from '../../components/search/SearchResults.svelte';
	import type { SearchMode } from '$lib/search/types';
	import type { DbExecutor } from '$lib/db/types';

	// DbExecutor is injected from the layout/context in a real app;
	// this page accepts it as a prop so it can be provided by the layout.
	export let exec: DbExecutor | null = null;

	let query = '';
	let mode: SearchMode = 'track';
	let artistQuery = '';

	function handleInput() {
		if (!exec) return;
		search.performSearch({ query, mode, artistQuery: mode === 'both' ? artistQuery : undefined }, exec);
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="mb-6 text-3xl font-bold text-white">Search Playlists</h1>

	<div class="mb-4 space-y-3">
		<div class="flex gap-2">
			<input
				bind:value={query}
				on:input={handleInput}
				type="text"
				placeholder={mode === 'artist' ? 'Artist name...' : 'Track name...'}
				class="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
			/>
			<select
				bind:value={mode}
				on:change={handleInput}
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
				on:input={handleInput}
				type="text"
				placeholder="Artist name..."
				class="w-full rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-green-500"
			/>
		{/if}
	</div>

	{#if $search.results}
		<p class="mb-3 text-sm text-gray-500">
			Found {$search.results.totalMatches} result{$search.results.totalMatches === 1 ? '' : 's'} in {$search.results.searchTimeMs}ms
		</p>
	{/if}

	<SearchResults
		results={$search.results}
		isSearching={$search.isSearching}
		error={$search.error}
	/>
</div>
