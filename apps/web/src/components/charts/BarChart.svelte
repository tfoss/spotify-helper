<script lang="ts">
	import { Chart, Svg, Axis, Bars } from 'layerchart';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import type { ChartConfig } from '$lib/charts/types';

	let { config }: { config: ChartConfig } = $props();

	let data = $derived(config.data);
	let labels = $derived(data.map((d) => d.label));
	let maxValue = $derived(Math.max(...data.map((d) => d.value), 0));

	let xScale = $derived(scaleBand().domain(labels).padding(0.2));
	let yScale = $derived(scaleLinear().domain([0, maxValue * 1.1]));

	/** Truncate long labels so they fit horizontally. */
	function truncate(label: string, max = 12): string {
		return label.length > max ? label.slice(0, max - 1) + '…' : label;
	}

	// SVG-attribute props for dark-theme readability.
	// Tailwind classes don't reach LayerChart's internal SVG text, so we use
	// raw SVG fill/stroke/font-size attributes passed through to the <text>/<line>.
	const tickLabelProps = { fill: '#9ca3af', 'font-size': 12 };
	const labelProps = { fill: '#d1d5db', 'font-size': 13 };
	const ruleProps = { stroke: '#374151' };
	const gridProps = { stroke: '#1f2937' };
</script>

{#if data.length === 0}
	<p class="py-10 text-center text-sm text-gray-500">No data available</p>
{:else}
	<div class="h-72 w-full">
		<Chart {data} x="label" y="value" {xScale} {yScale} padding={{ left: 56, bottom: 64, top: 8, right: 8 }}>
			<Svg>
				<Axis
					placement="left"
					label={config.yLabel}
					grid={gridProps}
					rule={ruleProps}
					{tickLabelProps}
					{labelProps}
				/>
				<Axis
					placement="bottom"
					label={config.xLabel}
					rule={ruleProps}
					format={(v: string) => truncate(v)}
					tickLabelProps={{ ...tickLabelProps, rotate: -35, textAnchor: 'end' }}
					{labelProps}
				/>
				<Bars fill="#22c55e" radius={2} />
			</Svg>
		</Chart>
	</div>
{/if}
