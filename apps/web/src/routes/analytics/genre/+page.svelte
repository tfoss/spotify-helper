<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth';
	import { SpotifyClient } from '$lib/spotify/client';
	import { getTopArtistGenres, getPlaylistGenres } from '$lib/analytics/genre';
	import { createGenreDistributionChart } from '$lib/charts/config';
	import type { GenreResult } from '$lib/analytics/genre';
	import type { ChartConfig } from '$lib/charts/types';
	import type { SpotifyPlaylist } from '$lib/spotify/types';
	import type { TimeRange } from '$lib/analytics/types';
	import ChartContainer from '$components/charts/ChartContainer.svelte';
	import DataSourceBadge from '$components/shared/DataSourceBadge.svelte';
	import SkeletonLoader from '$components/shared/SkeletonLoader.svelte';
	import ErrorMessage from '$components/shared/ErrorMessage.svelte';
	import EmptyState from '$components/shared/EmptyState.svelte';

	type ViewMode = 'top-artists' | 'playlist';

	let viewMode = $state<ViewMode>('top-artists');
	let timeRange = $state<TimeRange>('medium_term');
	let loading = $state(false);
	let error = $state<string | null>(null);

	let genreResult = $state<GenreResult | null>(null);
	let genreChart = $state<ChartConfig | null>(null);

	let playlists = $state<SpotifyPlaylist[]>([]);
	let selectedPlaylistId = $state<string>('');
	let playlistsLoading = $state(false);

	const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
		{ value: 'short_term', label: 'Last 4 Weeks' },
		{ value: 'medium_term', label: 'Last 6 Months' },
		{ value: 'long_term', label: 'All Time' },
	];

	function getClient(): SpotifyClient | null {
		const state = get(authStore);
		if (!state.isAuthenticated || !state.accessToken) return null;
		return new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken()
		);
	}

	async function loadPlaylists() {
		const client = getClient();
		if (!client) return;

		playlistsLoading = true;
		try {
			playlists = await client.getAllUserPlaylists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load playlists';
		} finally {
			playlistsLoading = false;
		}
	}

	async function fetchGenres() {
		const client = getClient();
		if (!client) return;

		loading = true;
		error = null;
		genreResult = null;
		genreChart = null;

		try {
			if (viewMode === 'top-artists') {
				genreResult = await getTopArtistGenres(client, timeRange);
			} else if (selectedPlaylistId) {
				genreResult = await getPlaylistGenres(client, selectedPlaylistId);
			} else {
				loading = false;
				return;
			}

			if (genreResult.genres.length > 0) {
				genreChart = createGenreDistributionChart(genreResult.genres);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load genre data';
		} finally {
			loading = false;
		}
	}

	function handleViewModeChange(mode: ViewMode) {
		viewMode = mode;
		genreResult = null;
		genreChart = null;
		error = null;
		if (mode === 'playlist' && playlists.length === 0) {
			loadPlaylists();
		}
	}

	function handleTimeRangeChange(range: TimeRange) {
		timeRange = range;
		if (viewMode === 'top-artists') fetchGenres();
	}

	function handlePlaylistChange(id: string) {
		selectedPlaylistId = id;
		if (id) fetchGenres();
	}

	onMount(() => {
		const state = get(authStore);
		if (state.isAuthenticated) fetchGenres();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<a href="/analytics" class="text-gray-400 hover:text-white">&larr; Analytics</a>
		<h1 class="text-3xl font-bold">Genre Distribution</h1>
	</div>

	{#if !$authStore.isAuthenticated}
		<EmptyState
			icon="🎵"
			title="Connect to Spotify to see your genre distribution"
			actionLabel="Connect with Spotify"
			onaction={() => authStore.login()}
		/>
	{:else}
		<!-- View mode toggle -->
		<div class="flex gap-2">
			<button
				class="rounded-lg px-4 py-2 text-sm font-medium {viewMode === 'top-artists'
					? 'bg-green-600 text-white'
					: 'bg-gray-800 text-gray-400 hover:text-white'}"
				onclick={() => handleViewModeChange('top-artists')}
			>
				From Top Artists
			</button>
			<button
				class="rounded-lg px-4 py-2 text-sm font-medium {viewMode === 'playlist'
					? 'bg-green-600 text-white'
					: 'bg-gray-800 text-gray-400 hover:text-white'}"
				onclick={() => handleViewModeChange('playlist')}
			>
				By Playlist
			</button>
		</div>

		<!-- Filters -->
		{#if viewMode === 'top-artists'}
			<div class="flex items-center gap-2 text-sm text-gray-400">
				<span>Time range:</span>
				{#each TIME_RANGE_OPTIONS as option}
					<button
						class="rounded px-2 py-1 {timeRange === option.value
							? 'bg-green-600 text-white'
							: 'bg-gray-800 text-gray-400 hover:text-white'}"
						onclick={() => handleTimeRangeChange(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex items-center gap-3">
				{#if playlistsLoading}
					<div class="flex items-center gap-2 text-sm text-gray-400">
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
						Loading playlists...
					</div>
				{:else}
					<select
						value={selectedPlaylistId}
						onchange={(e) => handlePlaylistChange(e.currentTarget.value)}
						class="rounded-lg bg-gray-800 px-3 py-2 text-gray-300 outline-none ring-1 ring-gray-700"
					>
						<option value="">Select a playlist...</option>
						{#each playlists as playlist}
							<option value={playlist.id}>{playlist.name} ({playlist.tracks.total} tracks)</option>
						{/each}
					</select>
				{/if}
			</div>
		{/if}

		<!-- Content -->
		{#if loading}
			<div class="space-y-4">
				<div class="flex items-center gap-3">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
					<span class="text-sm text-gray-400">Analyzing genres...</span>
				</div>
				<SkeletonLoader lines={5} showChart={true} />
			</div>
		{:else if error}
			<ErrorMessage message={error} onretry={fetchGenres} />
		{:else if genreResult && genreResult.genres.length > 0}
			<div class="flex items-center gap-2">
				<DataSourceBadge source={genreResult.source} />
				<span class="text-xs text-gray-500">
					{genreResult.artistCount} artists, {genreResult.genres.length} genres
				</span>
			</div>

			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Genre list -->
				<div class="space-y-2">
					{#each genreResult.genres.slice(0, 20) as genre, i}
						<div class="flex items-center gap-3 rounded-lg bg-gray-900 p-3">
							<span class="w-6 text-right text-sm font-bold text-gray-500">{i + 1}</span>
							<div class="flex-1">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-white capitalize">{genre.label}</span>
									<span class="text-xs text-gray-500">{genre.value} artist{genre.value === 1 ? '' : 's'}</span>
								</div>
								<div class="mt-1 h-1.5 w-full rounded-full bg-gray-800">
									<div
										class="h-1.5 rounded-full bg-green-500"
										style="width: {Math.round((genre.value / genreResult.genres[0].value) * 100)}%"
									></div>
								</div>
							</div>
						</div>
					{/each}
					{#if genreResult.genres.length > 20}
						<p class="text-center text-xs text-gray-600">
							+{genreResult.genres.length - 20} more genres
						</p>
					{/if}
				</div>

				<!-- Chart -->
				{#if genreChart}
					<ChartContainer config={genreChart} />
				{/if}
			</div>
		{:else if genreResult && genreResult.genres.length === 0}
			<EmptyState
				icon="🎶"
				title="No genre data available"
				description="The selected artists or playlist doesn't have genre information from Spotify."
			/>
		{:else if viewMode === 'playlist' && !selectedPlaylistId}
			<EmptyState
				icon="📋"
				title="Select a playlist"
				description="Choose a playlist above to see its genre breakdown."
			/>
		{/if}
	{/if}
</div>
