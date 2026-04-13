<script lang="ts">
	import { get } from 'svelte/store';
	import { dbStore } from '$lib/stores/db';
	import { getOrphanedTracks } from '$lib/db/queries';
	import type { OrphanedTrack } from '$lib/db/queries';
	import OrphanedTracksComponent from '../../components/search/OrphanedTracks.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';
	import ErrorMessage from '$components/shared/ErrorMessage.svelte';

	let tracks = $state<OrphanedTrack[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let dbReady = $derived($dbStore.isReady);
	let dbInitializing = $derived($dbStore.isInitializing);
	let dbError = $derived($dbStore.error);

	async function loadOrphanedTracks() {
		const { executor } = get(dbStore);
		if (!executor) return;
		isLoading = true;
		error = null;
		try {
			tracks = await getOrphanedTracks(executor);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load orphaned tracks';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (dbReady) {
			loadOrphanedTracks();
		}
	});
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-white">Orphaned Tracks</h1>
			<p class="mt-1 text-sm text-gray-500">
				Tracks in your library that aren't in any playlist
			</p>
		</div>
		<a
			href="/search"
			class="text-sm text-gray-400 hover:text-white transition-colors"
		>
			← Back to Search
		</a>
	</div>

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
			description="The local database hasn't been initialized yet."
		/>
	{:else}
		<OrphanedTracksComponent {tracks} {isLoading} {error} />
	{/if}
</div>
