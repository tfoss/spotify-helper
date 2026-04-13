<script lang="ts">
	import { syncStore } from '$lib/stores/sync';

	function formatTimeAgo(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return 'Just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	interface Props {
		onSync?: () => void;
	}

	let { onSync }: Props = $props();

	let syncPercent = $derived(
		$syncStore.progress && $syncStore.progress.total > 0
			? Math.round(($syncStore.progress.current / $syncStore.progress.total) * 100)
			: 0
	);
</script>

<div class="flex items-center gap-3 text-sm">
	{#if $syncStore.isSyncing}
		<div class="flex items-center gap-2 flex-1">
			<div class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			<div class="flex-1 min-w-0">
				{#if $syncStore.progress}
					{#if $syncStore.progress.phase === 'fetching_playlists'}
						<span class="text-gray-600 dark:text-gray-400">Fetching playlists...</span>
					{:else}
						<div class="flex items-center gap-2">
							<span class="text-gray-600 flex-shrink-0 dark:text-gray-400">
								{$syncStore.progress.current}/{$syncStore.progress.total}
							</span>
							<div class="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-800">
								<div
									class="h-1.5 rounded-full bg-green-500 transition-all duration-300"
									style="width: {syncPercent}%"
								></div>
							</div>
						</div>
					{/if}
				{:else}
					<span class="text-gray-600 dark:text-gray-400">Syncing...</span>
				{/if}
			</div>
		</div>
	{:else}
		<span class="text-gray-500 dark:text-gray-500">
			Synced: {formatTimeAgo($syncStore.lastSyncedAt)}
		</span>
		{#if $syncStore.lastStats}
			<span class="text-xs text-gray-400 dark:text-gray-600">
				({$syncStore.lastStats.playlistsTotal} playlists, {$syncStore.lastStats.tracksUpserted} tracks)
			</span>
		{/if}
		{#if onSync}
			<button
				onclick={onSync}
				class="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
			>
				Sync Now
			</button>
		{/if}
	{/if}

	{#if $syncStore.error}
		<span class="text-xs text-red-400">{$syncStore.error}</span>
	{/if}
</div>
