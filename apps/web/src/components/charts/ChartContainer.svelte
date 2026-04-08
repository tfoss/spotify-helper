<script lang="ts">
	import type { ChartConfig } from '$lib/charts/types';
	import BarChart from './BarChart.svelte';
	import LineChart from './LineChart.svelte';
	import PieChart from './PieChart.svelte';
	import HistogramChart from './HistogramChart.svelte';

	export let config: ChartConfig;

	let renderError: string | null = null;

	function handleError(err: unknown): void {
		renderError = err instanceof Error ? err.message : 'Failed to render chart';
	}
</script>

<div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
	<h3 class="mb-3 text-lg font-semibold text-white">{config.title}</h3>

	{#if renderError}
		<div class="py-10 text-center text-sm text-red-400">
			<p>Chart render error</p>
			<p class="mt-1 text-xs text-gray-500">{renderError}</p>
		</div>
	{:else if config.data.length === 0}
		<p class="py-10 text-center text-sm text-gray-500">No data available</p>
	{:else}
		{#if config.type === 'bar'}
			<BarChart {config} />
		{:else if config.type === 'line'}
			<LineChart {config} />
		{:else if config.type === 'pie' || config.type === 'donut'}
			<PieChart {config} />
		{:else if config.type === 'histogram'}
			<HistogramChart {config} />
		{:else}
			<p class="py-10 text-center text-sm text-gray-500">Unsupported chart type: {config.type}</p>
		{/if}
	{/if}
</div>
