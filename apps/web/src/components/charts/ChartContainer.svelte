<script lang="ts">
	import type { ChartConfig } from '$lib/charts/types';
	import BarChart from './BarChart.svelte';
	import LineChart from './LineChart.svelte';
	import PieChart from './PieChart.svelte';
	import HistogramChart from './HistogramChart.svelte';
	import ChartExportButtons from '$components/shared/ChartExportButtons.svelte';

	let { config }: { config: ChartConfig } = $props();

	let renderError = $state<string | null>(null);

	function handleError(err: unknown): void {
		renderError = err instanceof Error ? err.message : 'Failed to render chart';
	}
</script>

<div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white">{config.title}</h3>
		{#if config.data.length > 0}
			<ChartExportButtons {config} />
		{/if}
	</div>

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
