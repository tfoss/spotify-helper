<script lang="ts">
	import { Chart, Svg, Axis, Line, Tooltip } from 'layerchart';
	import { scalePoint, scaleLinear } from 'd3-scale';
	import type { ChartConfig } from '$lib/charts/types';

	let { config }: { config: ChartConfig } = $props();

	let data = $derived(config.data);
	let labels = $derived(data.map((d) => d.label));
	let maxValue = $derived(Math.max(...data.map((d) => d.value), 0));

	let xScale = $derived(scalePoint().domain(labels));
	let yScale = $derived(scaleLinear().domain([0, maxValue * 1.1]));
</script>

{#if data.length === 0}
	<p class="py-10 text-center text-sm text-gray-500">No data available</p>
{:else}
	<div class="h-64 w-full">
		<Chart {data} x="label" y="value" {xScale} {yScale} padding={{ left: 48, bottom: 40, top: 8, right: 8 }}>
			<Svg>
				<Axis placement="left" label={config.yLabel} />
				<Axis placement="bottom" label={config.xLabel} />
				<Line class="stroke-green-400 stroke-2" />
			</Svg>
			<Tooltip let:data>
				{#if data}
					<div class="rounded bg-gray-800 px-2 py-1 text-sm text-white shadow">
						<span class="font-medium">{data.label}</span>: {data.value}
					</div>
				{/if}
			</Tooltip>
		</Chart>
	</div>
{/if}
