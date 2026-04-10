<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { dbStore } from '$lib/stores/db';
	import {
		getPlaylistSummaries,
		getEraDataAllPlaylists,
		getEraDataForPlaylist,
		computeEraSummary,
	} from '$lib/analytics/era';
	import type { PlaylistSummary, EraResult } from '$lib/analytics/era';
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

	onMount(async () => {
		await loadPlaylists();
		await loadEraData();
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold">Era Heatmap</h1>
			<p class="mt-1 text-sm text-gray-400">Track release year distribution across your playlists</p>
		</div>

		<a
			href="/analytics"
			class="text-sm text-gray-400 hover:text-white"
		>
			&larr; Back to Analytics
		</a>
	</div>

	<!-- Playlist selector -->
	<div class="flex items-center gap-3">
		<label for="playlist-select" class="text-sm text-gray-400">Scope:</label>
		<select
			id="playlist-select"
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
				onclick={loadEraData}
				class="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
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

		<!-- Summary stats -->
		{#if eraSummary}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{#if eraSummary.oldestYear}
					<div class="rounded-lg bg-gray-900 p-4">
						<p class="text-xs text-gray-500">Oldest Track</p>
						<p class="text-2xl font-bold text-white">{eraSummary.oldestYear}</p>
					</div>
				{/if}
				{#if eraSummary.newestYear}
					<div class="rounded-lg bg-gray-900 p-4">
						<p class="text-xs text-gray-500">Newest Track</p>
						<p class="text-2xl font-bold text-white">{eraSummary.newestYear}</p>
					</div>
				{/if}
				{#if eraSummary.peakDecade}
					<div class="rounded-lg bg-gray-900 p-4">
						<p class="text-xs text-gray-500">Peak Decade</p>
						<p class="text-2xl font-bold text-green-400">{eraSummary.peakDecade}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Chart -->
		<div class="grid gap-6 lg:grid-cols-2">
			{#if eraChart}
				<ChartContainer config={eraChart} />
			{/if}

			<!-- Decade breakdown -->
			{#if eraSummary && eraSummary.decadeDistribution.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-gray-400">By Decade</h3>
					{#each eraSummary.decadeDistribution as decade}
						<div class="flex items-center gap-3 rounded-lg bg-gray-900 p-3">
							<span class="w-16 text-sm font-bold text-gray-500">{decade.label}</span>
							<div class="flex-1">
								<div
									class="h-4 rounded bg-green-600"
									style="width: {Math.max((decade.value / eraResult.totalTracks) * 100, 2)}%"
								></div>
							</div>
							<span class="w-12 text-right text-sm text-gray-400">{decade.value}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="py-20 text-center text-gray-500">
			<p>No release year data available.</p>
			<p class="mt-2 text-sm text-gray-600">Sync your playlists from Spotify to see the era heatmap.</p>
		</div>
	{/if}
</div>
