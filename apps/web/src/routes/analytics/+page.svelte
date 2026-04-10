<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth';
	import { dbStore } from '$lib/stores/db';
	import { SpotifyClient } from '$lib/spotify/client';
	import {
		getTopArtists,
		getTopTracks,
		getRecentlyPlayed,
		aggregateByArtist,
		aggregateByHour,
		persistRecentPlays,
		getLocalRecentPlays,
		getLocalArtistCounts,
		getLocalHourCounts,
	} from '$lib/analytics/index';
	import { createTopArtistsChart, createTopTracksChart, createActivityOverTimeChart } from '$lib/charts/config';
	import type { TimeRange, TopArtistsResult, TopTracksResult, RecentActivityResult } from '$lib/analytics/types';
	import type { ChartConfig } from '$lib/charts/types';
	import TimeRangeSelector from '$components/shared/TimeRangeSelector.svelte';
	import DataSourceBadge from '$components/shared/DataSourceBadge.svelte';
	import ChartContainer from '$components/charts/ChartContainer.svelte';

	type Tab = 'artists' | 'tracks' | 'recent' | 'history';

	let activeTab = $state<Tab>('artists');
	let timeRange = $state<TimeRange>('medium_term');
	let topN = $state(10);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let artistsResult = $state<TopArtistsResult | null>(null);
	let tracksResult = $state<TopTracksResult | null>(null);
	let recentResult = $state<RecentActivityResult | null>(null);
	let historyResult = $state<RecentActivityResult | null>(null);

	let artistsChart = $state<ChartConfig | null>(null);
	let tracksChart = $state<ChartConfig | null>(null);
	let activityChart = $state<ChartConfig | null>(null);
	let historyChart = $state<ChartConfig | null>(null);

	/** Time window options for local history queries (in milliseconds). */
	const HISTORY_WINDOWS = [
		{ label: '24h', ms: 24 * 60 * 60 * 1000 },
		{ label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
		{ label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
		{ label: 'All', ms: 0 },
	] as const;

	let historyWindow = $state(HISTORY_WINDOWS[1]); // default: 7d

	function getClient(): SpotifyClient | null {
		const state = get(authStore);
		if (!state.isAuthenticated || !state.accessToken) return null;
		return new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken()
		);
	}

	/** Map time range values to human-readable labels for chart titles. */
	const TIME_RANGE_LABELS: Record<TimeRange, string> = {
		short_term: 'Last 4 Weeks',
		medium_term: 'Last 6 Months',
		long_term: 'All Time',
	};

	/** Whether the active tab uses the Spotify time range selector. */
	function tabUsesTimeRange(tab: Tab): boolean {
		return tab === 'artists' || tab === 'tracks';
	}

	/** Whether the active tab uses the top-N selector. */
	function tabUsesTopN(tab: Tab): boolean {
		return tab === 'artists' || tab === 'tracks';
	}

	async function fetchArtists() {
		const client = getClient();
		if (!client) return;

		loading = true;
		error = null;
		try {
			artistsResult = await getTopArtists(client, timeRange);
			const chartData = artistsResult.items.map((item) => ({
				label: item.name,
				value: item.rank,
			}));
			artistsChart = createTopArtistsChart(chartData, topN);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load top artists';
		} finally {
			loading = false;
		}
	}

	async function fetchTracks() {
		const client = getClient();
		if (!client) return;

		loading = true;
		error = null;
		try {
			tracksResult = await getTopTracks(client, timeRange);
			const chartData = tracksResult.items.map((item) => ({
				label: item.name,
				value: item.rank,
			}));
			tracksChart = createTopTracksChart(chartData, topN);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load top tracks';
		} finally {
			loading = false;
		}
	}

	async function fetchRecent() {
		const client = getClient();
		if (!client) return;

		loading = true;
		error = null;
		try {
			recentResult = await getRecentlyPlayed(client);
			const hourData = aggregateByHour(recentResult.plays);
			activityChart = createActivityOverTimeChart(hourData);

			// Persist to local DB if available
			const { executor } = get(dbStore);
			if (executor) {
				await persistRecentPlays(recentResult.plays, executor);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load recent activity';
		} finally {
			loading = false;
		}
	}

	async function fetchHistory() {
		const { executor } = get(dbStore);
		if (!executor) {
			error = 'Database not initialized';
			return;
		}

		loading = true;
		error = null;
		try {
			const since = historyWindow.ms > 0 ? Date.now() - historyWindow.ms : 0;
			historyResult = await getLocalRecentPlays(executor, since);

			const hourData = await getLocalHourCounts(executor, since);
			historyChart = createActivityOverTimeChart(hourData);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load history';
		} finally {
			loading = false;
		}
	}

	async function loadData() {
		if (activeTab === 'artists') await fetchArtists();
		else if (activeTab === 'tracks') await fetchTracks();
		else if (activeTab === 'recent') await fetchRecent();
		else await fetchHistory();
	}

	function handleTabChange(tab: Tab) {
		activeTab = tab;
		loadData();
	}

	function handleTimeRangeChange(range: TimeRange) {
		timeRange = range;
		// Invalidate cached results so stale data is not shown
		artistsResult = null;
		artistsChart = null;
		tracksResult = null;
		tracksChart = null;
		if (tabUsesTimeRange(activeTab)) loadData();
	}

	function handleTopNChange(n: number) {
		topN = n;
		loadData();
	}

	function handleHistoryWindowChange(window: typeof HISTORY_WINDOWS[number]) {
		historyWindow = window;
		fetchHistory();
	}

	onMount(() => {
		const state = get(authStore);
		if (state.isAuthenticated) loadData();
	});

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'artists', label: 'Top Artists' },
		{ id: 'tracks', label: 'Top Tracks' },
		{ id: 'recent', label: 'Recent Activity' },
		{ id: 'history', label: 'Local History' },
	];

	const topNOptions = [5, 10, 20];
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-3xl font-bold">Analytics</h1>

		{#if tabUsesTimeRange(activeTab)}
			<div class="flex items-center gap-4">
				<TimeRangeSelector value={timeRange} onchange={handleTimeRangeChange} />
			</div>
		{/if}
	</div>

	<!-- Tab navigation -->
	<div class="flex items-center gap-1 border-b border-gray-800">
		{#each tabs as tab}
			<button
				class="border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === tab.id
					? 'border-green-500 text-green-400'
					: 'border-transparent text-gray-400 hover:text-white'}"
				onclick={() => handleTabChange(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
		<a
			href="/analytics/era"
			class="ml-auto rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
		>
			Era Heatmap &rarr;
		</a>
	</div>

	<!-- TopN selector for artists/tracks -->
	{#if tabUsesTopN(activeTab)}
		<div class="flex items-center gap-2 text-sm text-gray-400">
			<span>Show top</span>
			{#each topNOptions as n}
				<button
					class="rounded px-2 py-1 {topN === n
						? 'bg-green-600 text-white'
						: 'bg-gray-800 text-gray-400 hover:text-white'}"
					onclick={() => handleTopNChange(n)}
				>
					{n}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Content -->
	{#if !$authStore.isAuthenticated}
		<div class="py-20 text-center text-gray-400">
			<p class="text-lg">Connect to Spotify to view your analytics.</p>
			<button
				onclick={() => authStore.login()}
				class="mt-4 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
			>
				Connect with Spotify
			</button>
		</div>
	{:else if loading}
		<div class="flex items-center justify-center py-20">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-green-400 border-t-transparent"></div>
		</div>
	{:else if error}
		<div class="py-10 text-center">
			<p class="text-red-400">{error}</p>
			<button
				onclick={loadData}
				class="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
			>
				Retry
			</button>
		</div>
	{:else if activeTab === 'artists'}
		{#if artistsResult && artistsResult.items.length > 0}
			<div class="flex items-center gap-2">
				<DataSourceBadge source={artistsResult.source} />
				<span class="text-xs text-gray-500">{TIME_RANGE_LABELS[artistsResult.timeRange]}</span>
			</div>
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="space-y-3">
					{#each artistsResult.items.slice(0, topN) as item}
						<div class="flex items-center gap-3 rounded-lg bg-gray-900 p-3">
							<span class="w-8 text-right text-sm font-bold text-gray-500">#{item.rank}</span>
							{#if item.imageUrl}
								<img src={item.imageUrl} alt={item.name} class="h-10 w-10 rounded-full object-cover" />
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-500">
									<span class="text-xs">?</span>
								</div>
							{/if}
							<span class="font-medium text-white">{item.name}</span>
						</div>
					{/each}
				</div>
				{#if artistsChart}
					<ChartContainer config={artistsChart} />
				{/if}
			</div>
		{:else}
			<p class="py-20 text-center text-gray-500">No artist data available for this time range.</p>
		{/if}

	{:else if activeTab === 'tracks'}
		{#if tracksResult && tracksResult.items.length > 0}
			<div class="flex items-center gap-2">
				<DataSourceBadge source={tracksResult.source} />
				<span class="text-xs text-gray-500">{TIME_RANGE_LABELS[tracksResult.timeRange]}</span>
			</div>
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="space-y-3">
					{#each tracksResult.items.slice(0, topN) as item}
						<div class="flex items-center gap-3 rounded-lg bg-gray-900 p-3">
							<span class="w-8 text-right text-sm font-bold text-gray-500">#{item.rank}</span>
							<span class="font-medium text-white">{item.name}</span>
						</div>
					{/each}
				</div>
				{#if tracksChart}
					<ChartContainer config={tracksChart} />
				{/if}
			</div>
		{:else}
			<p class="py-20 text-center text-gray-500">No track data available for this time range.</p>
		{/if}

	{:else if activeTab === 'recent'}
		{#if recentResult && recentResult.plays.length > 0}
			<div class="flex items-center gap-2">
				<DataSourceBadge source="spotify" />
			</div>
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="space-y-3">
					{#each recentResult.plays as play}
						<div class="rounded-lg bg-gray-900 p-3">
							<p class="font-medium text-white">{play.trackName}</p>
							<p class="text-sm text-gray-400">{play.artistName} &middot; {play.albumName}</p>
							<p class="mt-1 text-xs text-gray-500">
								{play.playedAt.toLocaleString()}
							</p>
						</div>
					{/each}
				</div>
				{#if activityChart}
					<ChartContainer config={activityChart} />
				{/if}
			</div>
		{:else}
			<p class="py-20 text-center text-gray-500">No recent listening activity available.</p>
		{/if}

	{:else if activeTab === 'history'}
		<div class="flex items-center gap-2 text-sm text-gray-400">
			<span>Time window:</span>
			{#each HISTORY_WINDOWS as window}
				<button
					class="rounded px-2 py-1 {historyWindow === window
						? 'bg-green-600 text-white'
						: 'bg-gray-800 text-gray-400 hover:text-white'}"
					onclick={() => handleHistoryWindowChange(window)}
				>
					{window.label}
				</button>
			{/each}
		</div>

		{#if historyResult && historyResult.plays.length > 0}
			<div class="flex items-center gap-2">
				<DataSourceBadge source="local" />
				<span class="text-xs text-gray-500">{historyResult.totalCount} plays</span>
			</div>
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="space-y-3">
					{#each historyResult.plays as play}
						<div class="rounded-lg bg-gray-900 p-3">
							<p class="font-medium text-white">{play.trackName}</p>
							<p class="text-sm text-gray-400">{play.artistName} &middot; {play.albumName}</p>
							<p class="mt-1 text-xs text-gray-500">
								{play.playedAt.toLocaleString()}
							</p>
						</div>
					{/each}
				</div>
				{#if historyChart}
					<ChartContainer config={historyChart} />
				{/if}
			</div>
		{:else}
			<p class="py-20 text-center text-gray-500">No local history available. Visit the Recent Activity tab to sync data from Spotify.</p>
		{/if}
	{/if}
</div>
