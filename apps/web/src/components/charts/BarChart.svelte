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

	// LayerChart applies default classes `stroke-surface-100 [stroke-width:2px]`
	// to all tick/label Text components. `stroke-surface-100` is a Skeleton UI
	// utility not defined in this project, and `[stroke-width:2px]` is an
	// arbitrary Tailwind class whose CSS specificity overrides SVG presentation
	// attributes. The result: a 2px stroke (inheriting currentColor) paints over
	// the fill (paint-order: stroke), making text invisible.
	//
	// Fix: use the `classes` prop on each Axis — cls() uses tailwind-merge, so
	// `stroke-none` and `[stroke-width:0px]` properly supersede the defaults.
	const axisClasses = { tickLabel: 'stroke-none [stroke-width:0px]', label: 'stroke-none [stroke-width:0px]' };

	const tickLabelProps = {
		fill: '#9ca3af',
		'font-size': 12,
	};
	const labelProps = {
		fill: '#d1d5db',
		'font-size': 13,
	};
	const ruleProps = { stroke: '#374151' };
	const gridProps = { stroke: '#1f2937' };
</script>

{#if data.length === 0}
	<p class="py-10 text-center text-sm text-gray-500">No data available</p>
{:else}
	<div class="h-72 w-full">
		<Chart {data} x="label" y="value" {xScale} {yScale} padding={{ left: 72, bottom: 72, top: 8, right: 8 }}>
			<Svg>
				<Axis
					placement="left"
					label={config.yLabel}
					grid={gridProps}
					rule={ruleProps}
					{tickLabelProps}
					{labelProps}
					classes={axisClasses}
				/>
				<Axis
					placement="bottom"
					label={config.xLabel}
					rule={ruleProps}
					format={(v: string) => truncate(v)}
					tickLabelProps={{ ...tickLabelProps, rotate: -35, textAnchor: 'end' }}
					{labelProps}
					classes={axisClasses}
				/>
				<Bars fill="#22c55e" radius={2} />
			</Svg>
		</Chart>
	</div>
{/if}
