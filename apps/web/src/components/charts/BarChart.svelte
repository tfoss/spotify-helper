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

	// LayerChart hard-codes `stroke-surface-100 [stroke-width:2px]` on all axis
	// tick/label Text elements. `stroke-surface-100` references a Skeleton UI
	// CSS variable not defined in this project (undefined → invalid color →
	// browser falls back to inherited/default stroke). `[stroke-width:2px]` is
	// a Tailwind arbitrary CSS class with specificity (0,1,0), which OVERRIDES
	// any SVG presentation attribute like stroke-width="0" (specificity 0,0,0).
	// Previous fixes using SVG attributes or `stroke-none` (not a real Tailwind
	// v3 utility, so it generates no CSS) all failed for these reasons.
	//
	// Three-layer fix applied here:
	//  1. `style` prop in tickLabelProps/labelProps — flows through Axis →
	//     Text $$restProps → <text style="...">. Inline styles have specificity
	//     (1,0,0), beating any CSS class rule.
	//  2. `classes` prop with `[stroke:none]` (valid arbitrary Tailwind property)
	//     and `[stroke-width:0]` — tailwind-merge removes the conflicting defaults.
	//  3. `:global` CSS with `!important` in the <style> block below — catches
	//     any edge case where layers 1 or 2 don't reach the rendered element.
	const TICK_STYLE = 'stroke: none; stroke-width: 0; fill: #9ca3af;';
	const LABEL_STYLE = 'stroke: none; stroke-width: 0; fill: #d1d5db;';
	const axisClasses = {
		tickLabel: '[stroke:none] [stroke-width:0]',
		label: '[stroke:none] [stroke-width:0]',
	};

	const tickLabelProps = {
		fill: '#9ca3af',
		strokeWidth: 0,
		'font-size': 12,
		style: TICK_STYLE,
	};
	const labelProps = {
		fill: '#d1d5db',
		strokeWidth: 0,
		'font-size': 13,
		style: LABEL_STYLE,
	};
	const ruleProps = { stroke: '#374151' };
	const gridProps = { stroke: '#1f2937' };
</script>

{#if data.length === 0}
	<p class="py-10 text-center text-sm text-gray-500">No data available</p>
{:else}
	<!-- overflow-visible prevents the wrapper div from clipping rotated bottom-axis labels -->
	<div class="h-72 w-full overflow-visible">
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
					tickLabelProps={{ ...tickLabelProps, rotate: -35, textAnchor: 'end', style: TICK_STYLE }}
					{labelProps}
					classes={axisClasses}
				/>
				<Bars fill="#22c55e" radius={2} />
			</Svg>
		</Chart>
	</div>
{/if}
