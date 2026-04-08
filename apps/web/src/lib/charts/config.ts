/**
 * Factory functions that produce ChartConfig objects with sensible defaults.
 */

import type { ChartConfig, ChartDataPoint } from './types';

function applyTopN(data: ChartDataPoint[], topN?: number, direction: 'asc' | 'desc' = 'desc'): ChartDataPoint[] {
	const sorted = [...data].sort((a, b) =>
		direction === 'desc' ? b.value - a.value : a.value - b.value
	);
	return topN ? sorted.slice(0, topN) : sorted;
}

export function createTopArtistsChart(data: ChartDataPoint[], topN = 10): ChartConfig {
	return {
		type: 'bar',
		title: 'Top Artists',
		xLabel: 'Artist',
		yLabel: 'Plays',
		data: applyTopN(data, topN),
		options: { topN, sortDirection: 'desc' },
	};
}

export function createTopTracksChart(data: ChartDataPoint[], topN = 10): ChartConfig {
	return {
		type: 'bar',
		title: 'Top Tracks',
		xLabel: 'Track',
		yLabel: 'Plays',
		data: applyTopN(data, topN),
		options: { topN, sortDirection: 'desc' },
	};
}

export function createActivityOverTimeChart(data: ChartDataPoint[]): ChartConfig {
	return {
		type: 'line',
		title: 'Listening Activity Over Time',
		xLabel: 'Date',
		yLabel: 'Plays',
		data,
	};
}

export function createGenreDistributionChart(data: ChartDataPoint[]): ChartConfig {
	return {
		type: 'donut',
		title: 'Genre Distribution',
		data: applyTopN(data, 8),
		options: { topN: 8 },
	};
}

export function createReleaseYearChart(data: ChartDataPoint[]): ChartConfig {
	return {
		type: 'histogram',
		title: 'Tracks by Release Year',
		xLabel: 'Year',
		yLabel: 'Tracks',
		data: [...data].sort((a, b) => a.label.localeCompare(b.label)),
	};
}
