<script lang="ts">
	import { Chart, Svg, Pie } from 'layerchart';
	import type { ChartConfig } from '$lib/charts/types';

	let { config }: { config: ChartConfig } = $props();

	let data = $derived(config.data);
	let isDonut = $derived(config.type === 'donut');
	let total = $derived(data.reduce((sum, d) => sum + d.value, 0));

	const COLORS = [
		'#22c55e', '#3b82f6', '#a855f7', '#f59e0b',
		'#ef4444', '#06b6d4', '#ec4899', '#84cc16',
	];
</script>

{#if data.length === 0}
	<p class="py-10 text-center text-sm text-gray-500">No data available</p>
{:else}
	<div class="h-64 w-full">
		<Chart {data} x="label" y="value">
			<Svg>
				<Pie
					innerRadius={isDonut ? 0.5 : 0}
					padAngle={0.02}
				/>
			</Svg>
		</Chart>
	</div>
	<div class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
		{#each data as point, i}
			<div class="flex items-center gap-2 text-xs">
				<span class="inline-block h-3 w-3 flex-shrink-0 rounded-full" style="background: {COLORS[i % COLORS.length]}"></span>
				<span class="font-medium text-gray-200">{point.label}</span>
				<span class="text-gray-500">{total > 0 ? Math.round((point.value / total) * 100) : 0}%</span>
			</div>
		{/each}
	</div>
{/if}
