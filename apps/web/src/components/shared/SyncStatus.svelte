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
</script>

<div class="flex items-center gap-3 text-sm">
	{#if $syncStore.isSyncing}
		<div class="flex items-center gap-2">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-green-400 border-t-transparent"></div>
			{#if $syncStore.progress}
				<span class="text-gray-400">
					{#if $syncStore.progress.phase === 'fetching_playlists'}
						Fetching playlists...
					{:else}
						Syncing {$syncStore.progress.current}/{$syncStore.progress.total}...
					{/if}
				</span>
			{:else}
				<span class="text-gray-400">Syncing...</span>
			{/if}
		</div>
	{:else}
		<span class="text-gray-500">
			Synced: {formatTimeAgo($syncStore.lastSyncedAt)}
		</span>
		{#if onSync}
			<button
				onclick={onSync}
				class="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
			>
				Sync Now
			</button>
		{/if}
	{/if}

	{#if $syncStore.error}
		<span class="text-xs text-red-400">{$syncStore.error}</span>
	{/if}
</div>
