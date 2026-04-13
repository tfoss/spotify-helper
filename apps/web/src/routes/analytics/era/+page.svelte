<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { dbStore } from '$lib/stores/db';
	import {
		getPlaylistSummaries,
		getEraDataAllPlaylists,
		getEraDataForPlaylist,
		computeEraSummary,
		getTracksForYear,
	} from '$lib/analytics/era';
	import type { PlaylistSummary, EraResult, DrillTrack } from '$lib/analytics/era';
	import { createReleaseYearChart } from '$lib/charts/config';
	import type { ChartConfig } from '$lib/charts/types';
	import DataSourceBadge from '$components/shared/DataSourceBadge.svelte';
	import ChartContainer from '$components/charts/ChartContainer.svelte';

	let playlists = $state<PlaylistSummary[]>([]);
	let selectedPlaylistId = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let eraResult = $state<EraResult | null>(null);
	let eraChart = $state<ChartConfig | null>(null);
	let eraSummary = $state<ReturnType<typeof computeEraSummary> | null>(null);

	// Drill-down state
	let drillDecade = $state<string | null>(null);
	let drillYear = $state<string | null>(null);
	let drillTracks = $state<DrillTrack[]>([]);
	let drillLoading = $state(false);

	/** Years visible in the current drill level (all years, or filtered to drillDecade). */
	let visibleYears = $derived(
		drillDecade && eraResult
			? eraResult.data.filter((d) => d.label.startsWith(drillDecade!.replace('0s', '')))
			: (eraResult?.data ?? []),
	);

	/** The chart config for the currently visible year data. */
	let visibleChart = $derived(
		visibleYears.length > 0 ? createReleaseYearChart(visibleYears) : null,
	);

	async function loadPlaylists() {
		const { executor } = get(dbStore);
		if (!executor) return;

		try {
			playlists = await getPlaylistSummaries(executor);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load playlists';
		}
	}

	async function loadEraData() {
		const { executor } = get(dbStore);
		if (!executor) {
			error = 'Database not initialized';
			return;
		}

		loading = true;
		error = null;
		drillDecade = null;
		drillYear = null;
		drillTracks = [];
		try {
			eraResult = selectedPlaylistId
				? await getEraDataForPlaylist(executor, selectedPlaylistId)
				: await getEraDataAllPlaylists(executor);

			if (eraResult.data.length > 0) {
				eraChart = createReleaseYearChart(eraResult.data);
				eraSummary = computeEraSummary(eraResult.data);
			} else {
				eraChart = null;
				eraSummary = null;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load era data';
		} finally {
			loading = false;
		}
	}

	function handlePlaylistChange(playlistId: string | null) {
		selectedPlaylistId = playlistId;
		loadEraData();
	}

	function handleDecadeClick(decade: string) {
		if (drillDecade === decade) {
			// Collapse — go back to all-decade view
			drillDecade = null;
			drillYear = null;
			drillTracks = [];
		} else {
			drillDecade = decade;
			drillYear = null;
			drillTracks = [];
		}
	}

	async function handleYearClick(year: string) {
		if (drillYear === year) {
			// Collapse
			drillYear = null;
			drillTracks = [];
			return;
		}

		const { executor } = get(dbStore);
		if (!executor) return;

		drillYear = year;
		drillLoading = true;
		try {
			drillTracks = await getTracksForYear(executor, year, selectedPlaylistId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load tracks';
		} finally {
			drillLoading = false;
		}
	}

	function handleBreadcrumbAll() {
		drillDecade = null;
		drillYear = null;
		drillTracks = [];
	}

	function handleBreadcrumbDecade() {
		drillYear = null;
		drillTracks = [];
	}

	onMount(async () => {
		await loadPlaylists();
		await loadEraData();
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold">Era Heatmap</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Track release year distribution across your playlists</p>
		</div>

		<a
			href="/analytics"
			class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
		>
			&larr; Back to Analytics
		</a>
	</div>

	<!-- Playlist selector -->
	<div class="flex items-center gap-3">
		<label for="playlist-select" class="text-sm text-gray-600 dark:text-gray-400">Scope:</label>
		<select
			id="playlist-select"
			class="rounded-lg bg-gray-100 px-3 py-2 text-gray-700 outline-none ring-1 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
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
				onclick={loadEraData}
				class="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Retry
			</button>
		</div>
	{:else if eraResult && eraResult.data.length > 0}
		<div class="flex items-center gap-2">
			<DataSourceBadge source="local" />
			<span class="text-xs text-gray-500">
				{eraResult.scopeLabel} &middot; {eraResult.totalTracks} tracks
			</span>
		</div>

		<!-- Breadcrumb -->
		{#if drillDecade || drillYear}
			<nav class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
				<button onclick={handleBreadcrumbAll} class="hover:text-gray-900 dark:hover:text-white">All decades</button>
				{#if drillDecade}
					<span>&rsaquo;</span>
					{#if drillYear}
						<button onclick={handleBreadcrumbDecade} class="hover:text-gray-900 dark:hover:text-white">{drillDecade}</button>
					{:else}
						<span class="text-gray-900 dark:text-white">{drillDecade}</span>
					{/if}
				{/if}
				{#if drillYear}
					<span>&rsaquo;</span>
					<span class="text-gray-900 dark:text-white">{drillYear}</span>
				{/if}
			</nav>
		{/if}

		<!-- Summary stats (top level only) -->
		{#if !drillDecade && eraSummary}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{#if eraSummary.oldestYear}
					<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
						<p class="text-xs text-gray-500">Oldest Track</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{eraSummary.oldestYear}</p>
					</div>
				{/if}
				{#if eraSummary.newestYear}
					<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
						<p class="text-xs text-gray-500">Newest Track</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{eraSummary.newestYear}</p>
					</div>
				{/if}
				{#if eraSummary.peakDecade}
					<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
						<p class="text-xs text-gray-500">Peak Decade</p>
						<p class="text-2xl font-bold text-green-500 dark:text-green-400">{eraSummary.peakDecade}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Chart + side panel -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Chart (filtered to current drill level) -->
			{#if visibleChart}
				<ChartContainer config={visibleChart} />
			{/if}

			{#if drillYear}
				<!-- Song list for selected year -->
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Songs from {drillYear}
						<span class="ml-1 text-gray-400 dark:text-gray-600">({drillTracks.length})</span>
					</h3>
					{#if drillLoading}
						<div class="flex items-center gap-2 py-4 text-sm text-gray-500">
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
							Loading…
						</div>
					{:else if drillTracks.length > 0}
						<div class="max-h-96 space-y-2 overflow-y-auto">
							{#each drillTracks as track}
								<div class="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-900">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{track.name}</p>
									<p class="text-xs text-gray-600 dark:text-gray-400">{track.artistName} &middot; {track.albumName}</p>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-500">No tracks found.</p>
					{/if}
				</div>

			{:else if drillDecade}
				<!-- Year list for selected decade -->
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Years in {drillDecade} — click a year to see songs
					</h3>
					{#each visibleYears as yearPoint}
						<button
							class="flex w-full items-center gap-3 rounded-lg bg-gray-100 p-3 text-left hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 {drillYear === yearPoint.label ? 'ring-1 ring-green-500' : ''}"
							onclick={() => handleYearClick(yearPoint.label)}
						>
							<span class="w-12 text-sm font-bold text-gray-600 dark:text-gray-400">{yearPoint.label}</span>
							<div class="flex-1">
								<div
									class="h-3 rounded bg-green-600"
									style="width: {Math.max((yearPoint.value / Math.max(...visibleYears.map(y => y.value))) * 100, 4)}%"
								></div>
							</div>
							<span class="w-10 text-right text-sm text-gray-600 dark:text-gray-400">{yearPoint.value}</span>
							<span class="text-xs text-gray-400 dark:text-gray-600">&rsaquo;</span>
						</button>
					{/each}
				</div>

			{:else if eraSummary && eraSummary.decadeDistribution.length > 0}
				<!-- Default: decade breakdown — click to drill in -->
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">By Decade — click to expand</h3>
					{#each eraSummary.decadeDistribution as decade}
						<button
							class="flex w-full items-center gap-3 rounded-lg bg-gray-100 p-3 text-left hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 {drillDecade === decade.label ? 'ring-1 ring-green-500' : ''}"
							onclick={() => handleDecadeClick(decade.label)}
						>
							<span class="w-16 text-sm font-bold text-gray-500">{decade.label}</span>
							<div class="flex-1">
								<div
									class="h-4 rounded bg-green-600"
									style="width: {Math.max((decade.value / eraResult.totalTracks) * 100, 2)}%"
								></div>
							</div>
							<span class="w-12 text-right text-sm text-gray-600 dark:text-gray-400">{decade.value}</span>
							<span class="text-xs text-gray-400 dark:text-gray-600">&rsaquo;</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="py-20 text-center text-gray-500">
			<p>No release year data available.</p>
			<p class="mt-2 text-sm text-gray-400 dark:text-gray-600">Sync your playlists from Spotify to see the era heatmap.</p>
		</div>
	{/if}
</div>
