<script lang="ts">
	import { Chart, Svg, Arc, Tooltip } from 'layerchart';
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
				<Arc
					innerRadius={isDonut ? 0.5 : 0}
					padAngle={0.02}
					let:index
				>
					<svelte:fragment slot="default">
						<path fill={COLORS[index % COLORS.length]} />
					</svelte:fragment>
				</Arc>
			</Svg>
			<Tooltip let:data>
				{#if data}
					<div class="rounded bg-gray-800 px-2 py-1 text-sm text-white shadow">
						<span class="font-medium">{data.label}</span>: {data.value}
						({total > 0 ? Math.round((data.value / total) * 100) : 0}%)
					</div>
				{/if}
			</Tooltip>
		</Chart>
	</div>
	<div class="mt-2 flex flex-wrap justify-center gap-3">
		{#each data as point, i}
			<div class="flex items-center gap-1.5 text-xs text-gray-300">
				<span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {COLORS[i % COLORS.length]}"></span>
				{point.label}
			</div>
		{/each}
	</div>
{/if}
