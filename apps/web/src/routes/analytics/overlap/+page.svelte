<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { dbStore } from '$lib/stores/db';
	import { getPlaylistSummaries } from '$lib/analytics/era';
	import type { PlaylistSummary } from '$lib/analytics/era';
	import { buildOverlapMatrix, similarityToIntensity } from '$lib/analytics/overlap';
	import type { OverlapMatrix } from '$lib/analytics/overlap';
	import DataSourceBadge from '$components/shared/DataSourceBadge.svelte';

	let playlists = $state<PlaylistSummary[]>([]);
	let selectedIds = $state<Set<string>>(new Set());
	let loading = $state(false);
	let error = $state<string | null>(null);
	let matrix = $state<OverlapMatrix | null>(null);

	async function loadPlaylists() {
		const { executor } = get(dbStore);
		if (!executor) return;

		try {
			playlists = await getPlaylistSummaries(executor);
			// Auto-select first 5 playlists if available
			const initial = playlists.slice(0, 5).map((p) => p.id);
			selectedIds = new Set(initial);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load playlists';
		}
	}

	async function loadMatrix() {
		const { executor } = get(dbStore);
		if (!executor || selectedIds.size < 2) {
			matrix = null;
			return;
		}

		loading = true;
		error = null;
		try {
			matrix = await buildOverlapMatrix(executor, Array.from(selectedIds));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to compute overlap';
		} finally {
			loading = false;
		}
	}

	function togglePlaylist(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
		loadMatrix();
	}

	function selectAll() {
		selectedIds = new Set(playlists.map((p) => p.id));
		loadMatrix();
	}

	function selectNone() {
		selectedIds = new Set();
		matrix = null;
	}

	onMount(async () => {
		await loadPlaylists();
		if (selectedIds.size >= 2) {
			await loadMatrix();
		}
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold">Playlist Overlap</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Track commonality between your playlists</p>
		</div>

		<a
			href="/analytics"
			class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
		>
			&larr; Back to Analytics
		</a>
	</div>

	<!-- Playlist multi-selector -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Select playlists (2 or more):</h3>
			<div class="flex gap-2">
				<button
					class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
					onclick={selectAll}
				>
					Select All
				</button>
				<button
					class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
					onclick={selectNone}
				>
					Clear
				</button>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			{#each playlists as playlist}
				<button
					class="rounded-full px-3 py-1 text-sm transition-colors {selectedIds.has(playlist.id)
						? 'bg-green-600 text-white'
						: 'bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white'}"
					onclick={() => togglePlaylist(playlist.id)}
				>
					{playlist.name}
				</button>
			{/each}
		</div>

		{#if playlists.length === 0}
			<p class="text-sm text-gray-500">No playlists found. Sync your playlists from Spotify first.</p>
		{/if}
	</div>

	<!-- Content -->
	{#if selectedIds.size < 2}
		<div class="py-10 text-center text-gray-500">
			<p>Select at least 2 playlists to see their overlap.</p>
		</div>
	{:else if loading}
		<div class="flex items-center justify-center py-20">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-green-400 border-t-transparent"></div>
		</div>
	{:else if error}
		<div class="py-10 text-center">
			<p class="text-red-400">{error}</p>
			<button
				onclick={loadMatrix}
				class="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Retry
			</button>
		</div>
	{:else if matrix}
		<div class="flex items-center gap-2">
			<DataSourceBadge source="local" />
			<span class="text-xs text-gray-500">
				{matrix.playlistIds.length} playlists compared
			</span>
		</div>

		<!-- Legend -->
		<div class="flex items-center gap-2 text-xs text-gray-500">
			<span>Similarity:</span>
			<div class="flex items-center gap-1">
				<div class="h-4 w-4 rounded bg-gray-200 dark:bg-gray-800"></div>
				<span>0%</span>
			</div>
			<div class="h-4 w-16 rounded" style="background: linear-gradient(to right, rgb(22, 101, 52), rgb(34, 197, 94))"></div>
			<div class="flex items-center gap-1">
				<div class="h-4 w-4 rounded bg-green-500"></div>
				<span>100%</span>
			</div>
		</div>

		<!-- Matrix -->
		<div class="overflow-x-auto">
			<table class="border-collapse">
				<thead>
					<tr>
						<th class="p-2"></th>
						{#each matrix.playlistNames as name, j}
							<th class="max-w-24 truncate p-2 text-xs font-medium text-gray-600 dark:text-gray-400" title={name}>
								{name}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each matrix.cells as row, i}
						<tr>
							<td class="max-w-32 truncate whitespace-nowrap p-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400" title={matrix.playlistNames[i]}>
								{matrix.playlistNames[i]}
							</td>
							{#each row as cell, j}
								{@const intensity = similarityToIntensity(cell.similarity)}
								{@const isDiagonal = i === j}
								<td
									class="p-1"
									title="{matrix.playlistNames[i]} ↔ {matrix.playlistNames[j]}: {cell.sharedCount} shared tracks ({Math.round(cell.similarity * 100)}% similar)"
								>
									<div
										class="flex h-12 w-12 items-center justify-center rounded text-xs font-bold {isDiagonal
											? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
											: 'text-white'}"
										style={isDiagonal
											? ''
											: `background-color: rgba(34, 197, 94, ${Math.max(cell.similarity * 0.8, 0.05)})`}
									>
										{isDiagonal ? cell.sharedCount : cell.sharedCount}
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Summary stats -->
		{@const allCells = matrix.cells.flatMap((row, i) => row.filter((_, j) => j > i))}
		{@const maxOverlap = allCells.reduce((max, c) => c.sharedCount > max.sharedCount ? c : max, allCells[0])}
		{@const avgSimilarity = allCells.length > 0 ? allCells.reduce((sum, c) => sum + c.similarity, 0) / allCells.length : 0}

		{#if allCells.length > 0}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
				<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
					<p class="text-xs text-gray-500">Avg Similarity</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(avgSimilarity * 100)}%</p>
				</div>
				{#if maxOverlap}
					<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
						<p class="text-xs text-gray-500">Most Overlap</p>
						<p class="text-2xl font-bold text-green-500 dark:text-green-400">{maxOverlap.sharedCount} tracks</p>
					</div>
				{/if}
				<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-900">
					<p class="text-xs text-gray-500">Pairs Compared</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{allCells.length}</p>
				</div>
			</div>
		{/if}
	{/if}
</div>
