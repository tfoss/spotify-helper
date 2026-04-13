<script lang="ts">
	import type { OrphanedTrack } from '$lib/db/queries';

	let {
		tracks,
		isLoading = false,
		error = null,
	}: {
		tracks: OrphanedTrack[];
		isLoading?: boolean;
		error?: string | null;
	} = $props();
</script>

{#if isLoading}
	<div class="flex items-center justify-center py-16">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
		<span class="ml-3 text-gray-400">Loading orphaned tracks...</span>
	</div>
{:else if error}
	<div class="rounded-lg border border-red-800 bg-red-950/50 p-6 text-center">
		<p class="text-red-400">{error}</p>
	</div>
{:else if tracks.length === 0}
	<div class="py-16 text-center">
		<p class="text-3xl">🎵</p>
		<p class="mt-3 text-lg text-gray-400">No orphaned tracks found</p>
		<p class="mt-1 text-sm text-gray-600">All your tracks are in at least one playlist.</p>
	</div>
{:else}
	<p class="mb-4 text-sm text-gray-500">
		{tracks.length} track{tracks.length === 1 ? '' : 's'} not in any playlist
	</p>
	<ul class="space-y-2">
		{#each tracks as track (track.id)}
			<li class="flex items-center gap-4 rounded-lg bg-gray-800/60 px-4 py-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-700 text-gray-400">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
					</svg>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium text-white">{track.name}</p>
					<p class="truncate text-sm text-gray-400">
						{track.artist_name}
						{#if track.album_name}
							<span class="mx-1 text-gray-600">·</span>
							<span class="text-gray-500">{track.album_name}</span>
						{/if}
					</p>
				</div>
			</li>
		{/each}
	</ul>
{/if}
