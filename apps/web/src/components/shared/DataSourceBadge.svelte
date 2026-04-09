<script lang="ts">
	interface Props {
		source: 'spotify' | 'local';
	}

	let { source }: Props = $props();
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {source === 'spotify'
		? 'bg-green-900/50 text-green-400'
		: 'bg-blue-900/50 text-blue-400'}"
>
	<span class="h-1.5 w-1.5 rounded-full {source === 'spotify' ? 'bg-green-400' : 'bg-blue-400'}"></span>
	{source === 'spotify' ? 'Live from Spotify' : 'Cached locally'}
</span>
