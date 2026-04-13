<script lang="ts">
	import type { ChartConfig } from '$lib/charts/types';
	import { downloadChartAsCsv, downloadChartAsJson } from '$lib/charts/export';

	let { config }: { config: ChartConfig } = $props();
</script>

<div class="flex items-center gap-1">
	<button
		onclick={() => downloadChartAsCsv(config)}
		title="Download as CSV"
		class="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
	>
		CSV ↓
	</button>
	<button
		onclick={() => downloadChartAsJson(config)}
		title="Download as JSON"
		class="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
	>
		JSON ↓
	</button>
</div>
