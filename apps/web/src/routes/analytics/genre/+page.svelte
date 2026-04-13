<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth';
	import { dbStore } from '$lib/stores/db';
	import { SpotifyClient } from '$lib/spotify/client';
	import { syncArtistGenres } from '$lib/search/sync';
	import {
		getGenreDistributionAll,
		getGenreDistributionForPlaylist,
		collapseSmallGenres,
	} from '$lib/analytics/genre';
	import { getPlaylistSummaries } from '$lib/analytics/era';
	import type { PlaylistSummary } from '$lib/analytics/era';
	import type { GenreDistribution } from '$lib/analytics/genre';
	import { createGenreDistributionChart } from '$lib/charts/config';
	import type { ChartConfig } from '$lib/charts/types';
	import DataSourceBadge from '$components/shared/DataSourceBadge.svelte';
	import ChartContainer from '$components/charts/ChartContainer.svelte';

	let playlists = $state<PlaylistSummary[]>([]);
	let selectedPlaylistId = $state<string | null>(null);
	let loading = $state(false);
	let syncing = $state(false);
	let error = $state<string | null>(null);

	let genreResult = $state<GenreDistribution | null>(null);
	let genreChart = $state<ChartConfig | null>(null);

	function getClient(): SpotifyClient | null {
		const state = get(authStore);
		if (!state.isAuthenticated || !state.accessToken) return null;
		return new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken(),
		);
	}

	async function loadPlaylists() {
		const { executor } = get(dbStore);
		if (!executor) return;

		try {
			playlists = await getPlaylistSummaries(executor);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load playlists';
		}
	}

	async function loadGenreData() {
		const { executor } = get(dbStore);
		if (!executor) {
			error = 'Database not initialized';
			return;
		}

		loading = true;
		error = null;
		try {
			genreResult = selectedPlaylistId
				? await getGenreDistributionForPlaylist(executor, selectedPlaylistId)
				: await getGenreDistributionAll(executor);

			if (genreResult.data.length > 0) {
				const chartData = collapseSmallGenres(genreResult.data);
				genreChart = createGenreDistributionChart(chartData);
			} else {
				genreChart = null;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load genre data';
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch artist genres from Spotify for all artists stored in the local DB,
	 * then reload the genre chart.
	 */
	async function handleSyncArtistData() {
		const client = getClient();
		const { executor } = get(dbStore);
		if (!client || !executor) return;

		syncing = true;
		error = null;
		try {
			// Collect all artist IDs currently stored in the tracks table
			const rows = await executor(`SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL`);
			const artistIds = new Set<string>(rows.map((r) => r.artist_id as string));
			await syncArtistGenres(client, executor, artistIds);
			await loadGenreData();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sync artist data';
		} finally {
			syncing = false;
		}
	}

	function handlePlaylistChange(playlistId: string | null) {
		selectedPlaylistId = playlistId;
		loadGenreData();
	}

	onMount(async () => {
		await loadPlaylists();
		await loadGenreData();
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold">Genre Distribution</h1>
			<p class="mt-1 text-sm text-gray-400">Explore genre breakdown across your playlists</p>
		</div>

		<div class="flex items-center gap-3">
			{#if $authStore.isAuthenticated}
				<button
					onclick={handleSyncArtistData}
					disabled={syncing}
					class="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
				>
					{syncing ? 'Syncing…' : 'Sync artist data'}
				</button>
			{/if}
			<a
				href="/analytics"
				class="text-sm text-gray-400 hover:text-white"
			>
				&larr; Back to Analytics
			</a>
		</div>
	</div>

	<!-- Playlist selector -->
	<div class="flex items-center gap-3">
		<label for="genre-playlist-select" class="text-sm text-gray-400">Scope:</label>
		<select
			id="genre-playlist-select"
			class="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 outline-none ring-1 ring-gray-700"
			onchange={(e) => handlePlaylistChange(e.currentTarget.value || null)}
		>
			<option value="">All Playlists</option>
			{#each playlists as playlist}
				<option value={playlist.id}>
					{playlist.name} ({playlist.trackCount} tracks)
				</option>
			{/each}
		</select>
	</div>

	<!-- Content -->
	{#if loading}
		<div class="flex items-center justify-center py-20">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-green-400 border-t-transparent"></div>
		</div>
	{:else if error}
		<div class="py-10 text-center">
			<p class="text-red-400">{error}</p>
			<button
				onclick={loadGenreData}
				class="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
			>
				Retry
			</button>
		</div>
	{:else if genreResult && genreResult.data.length > 0}
		<div class="flex items-center gap-2">
			<DataSourceBadge source="local" />
			<span class="text-xs text-gray-500">
				{genreResult.scopeLabel} &middot;
				{genreResult.totalTagged} genre tags across {genreResult.totalTracks} tracks
			</span>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Chart -->
			{#if genreChart}
				<ChartContainer config={genreChart} />
			{/if}

			<!-- Genre list -->
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-gray-400">All Genres</h3>
				{#each genreResult.data as genre, i}
					<div class="flex items-center gap-3 rounded-lg bg-gray-900 p-3">
						<span class="w-8 text-right text-sm font-bold text-gray-500">#{i + 1}</span>
						<span class="flex-1 font-medium text-white">{genre.label}</span>
						<div class="w-24">
							<div
								class="h-3 rounded bg-green-600"
								style="width: {Math.max((genre.value / genreResult.data[0].value) * 100, 5)}%"
							></div>
						</div>
						<span class="w-10 text-right text-sm text-gray-400">{genre.value}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="py-20 text-center text-gray-500">
			<p>No genre data available.</p>
			<p class="mt-2 text-sm text-gray-600">
				Genre data is populated when artist information is synced from Spotify.
				{#if $authStore.isAuthenticated}
					Click <strong class="text-gray-400">Sync artist data</strong> above, or sync your playlists first.
				{:else}
					Connect to Spotify and sync your playlists to populate genre data.
				{/if}
			</p>
		</div>
	{/if}
</div>
