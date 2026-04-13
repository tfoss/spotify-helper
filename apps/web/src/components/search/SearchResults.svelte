<script lang="ts">
	import type { SearchResults } from '$lib/search/types';
	import HighlightText from './HighlightText.svelte';

	interface Props {
		results: SearchResults | null;
		isSearching?: boolean;
		error?: string | null;
		searchQuery?: string;
	}

	let { results = null, isSearching = false, error = null, searchQuery = '' }: Props = $props();

	const MATCH_BADGE: Record<string, string> = {
		track: 'bg-green-900 text-green-300',
		artist: 'bg-blue-900 text-blue-300',
		album: 'bg-purple-900 text-purple-300',
	};
</script>

{#if isSearching}
	<p class="py-6 text-center text-sm text-gray-500">Searching...</p>
{:else if error}
	<p class="py-6 text-center text-sm text-red-400">{error}</p>
{:else if results && results.items.length > 0}
	<p class="mb-2 px-2 text-xs text-gray-500">
		{results.totalMatches} result{results.totalMatches === 1 ? '' : 's'} in {results.searchTimeMs}ms
	</p>
	<ul class="space-y-1">
		{#each results.items as item (item.playlistId + item.trackId)}
			<li>
				<a
					href={item.spotifyPlaylistUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate font-medium text-gray-900 dark:text-white">
								<HighlightText text={item.trackName} query={searchQuery} />
							</span>
							<span class="shrink-0 rounded px-1.5 py-0.5 text-xs {MATCH_BADGE[item.matchType]}">
								{item.matchType}
							</span>
						</div>
						<p class="truncate text-sm text-gray-600 dark:text-gray-400">
							<HighlightText text={item.artistName} query={searchQuery} /> · {item.albumName}
						</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="truncate text-sm font-medium text-gray-700 dark:text-gray-300">{item.playlistName}</p>
						<p class="text-xs text-gray-500">{item.playlistOwner}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{:else if results && results.items.length === 0}
	<p class="py-6 text-center text-sm text-gray-500">No results found.</p>
{:else}
	<p class="py-6 text-center text-sm text-gray-400 dark:text-gray-600">Start typing to search your playlists.</p>
{/if}
