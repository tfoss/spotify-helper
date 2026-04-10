/**
 * Unit tests for chart config factory functions.
 *
 * Tests cover:
 * - All five factory functions in lib/charts/config.ts
 * - Data sorting and topN limiting behavior
 * - Empty data, single-point, and large dataset edge cases
 * - Output structure validity for LayerChart compatibility
 * - Tooltip-ready data (every point has label + value)
 */

import { describe, it, expect } from 'vitest';
import {
	createTopArtistsChart,
	createTopTracksChart,
	createActivityOverTimeChart,
	createGenreDistributionChart,
	createReleaseYearChart,
} from '../../../src/lib/charts/config';
import type { ChartConfig, ChartDataPoint, ChartType } from '../../../src/lib/charts/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CHART_TYPES: ChartType[] = ['bar', 'line', 'pie', 'donut', 'histogram'];

function assertValidConfig(config: ChartConfig): void {
	expect(typeof config.type).toBe('string');
	expect(VALID_CHART_TYPES).toContain(config.type);
	expect(typeof config.title).toBe('string');
	expect(config.title.length).toBeGreaterThan(0);
	expect(Array.isArray(config.data)).toBe(true);
}

function assertAllPointsValid(data: ChartDataPoint[]): void {
	for (const point of data) {
		expect(typeof point.label).toBe('string');
		expect(typeof point.value).toBe('number');
		expect(Number.isFinite(point.value)).toBe(true);
	}
}

function makeSampleData(count: number): ChartDataPoint[] {
	return Array.from({ length: count }, (_, i) => ({
		label: `Item ${i + 1}`,
		value: (count - i) * 10,
	}));
}

const EMPTY_DATA: ChartDataPoint[] = [];

const SINGLE_POINT: ChartDataPoint[] = [{ label: 'Only', value: 42 }];

const SAMPLE_3: ChartDataPoint[] = [
	{ label: 'Alpha', value: 30 },
	{ label: 'Beta', value: 50 },
	{ label: 'Gamma', value: 10 },
];

// ---------------------------------------------------------------------------
// createTopArtistsChart
// ---------------------------------------------------------------------------

describe('createTopArtistsChart', () => {
	it('returns a valid bar chart config', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		assertValidConfig(config);
		expect(config.type).toBe('bar');
	});

	it('sets title to "Top Artists"', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		expect(config.title).toBe('Top Artists');
	});

	it('sets axis labels', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		expect(config.xLabel).toBe('Artist');
		expect(config.yLabel).toBe('Plays');
	});

	it('sorts data descending by value', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		for (let i = 1; i < config.data.length; i++) {
			expect(config.data[i - 1].value).toBeGreaterThanOrEqual(config.data[i].value);
		}
	});

	it('defaults topN to 10', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		expect(config.options?.topN).toBe(10);
	});

	it('limits data to custom topN', () => {
		const many = makeSampleData(20);
		const config = createTopArtistsChart(many, 5);
		expect(config.data).toHaveLength(5);
		expect(config.options?.topN).toBe(5);
	});

	it('returns all items when topN exceeds data length', () => {
		const config = createTopArtistsChart(SAMPLE_3, 100);
		expect(config.data).toHaveLength(3);
	});

	it('handles empty data', () => {
		const config = createTopArtistsChart(EMPTY_DATA);
		assertValidConfig(config);
		expect(config.data).toHaveLength(0);
	});

	it('handles single data point', () => {
		const config = createTopArtistsChart(SINGLE_POINT);
		assertValidConfig(config);
		expect(config.data).toHaveLength(1);
		expect(config.data[0].label).toBe('Only');
	});

	it('all data points have valid label and value', () => {
		const config = createTopArtistsChart(makeSampleData(15));
		assertAllPointsValid(config.data);
	});

	it('does not mutate the input array', () => {
		const input = [...SAMPLE_3];
		const originalOrder = input.map((d) => d.label);
		createTopArtistsChart(input);
		expect(input.map((d) => d.label)).toEqual(originalOrder);
	});

	it('preserves metadata on data points', () => {
		const dataWithMeta: ChartDataPoint[] = [
			{ label: 'A', value: 10, metadata: { id: 'artist-1' } },
			{ label: 'B', value: 20, metadata: { id: 'artist-2' } },
		];
		const config = createTopArtistsChart(dataWithMeta);
		expect(config.data[0].metadata).toEqual({ id: 'artist-2' });
		expect(config.data[1].metadata).toEqual({ id: 'artist-1' });
	});
});

// ---------------------------------------------------------------------------
// createTopTracksChart
// ---------------------------------------------------------------------------

describe('createTopTracksChart', () => {
	it('returns a valid bar chart config', () => {
		const config = createTopTracksChart(SAMPLE_3);
		assertValidConfig(config);
		expect(config.type).toBe('bar');
	});

	it('sets title to "Top Tracks"', () => {
		const config = createTopTracksChart(SAMPLE_3);
		expect(config.title).toBe('Top Tracks');
	});

	it('sets axis labels for tracks', () => {
		const config = createTopTracksChart(SAMPLE_3);
		expect(config.xLabel).toBe('Track');
		expect(config.yLabel).toBe('Plays');
	});

	it('sorts data descending by value', () => {
		const config = createTopTracksChart(SAMPLE_3);
		for (let i = 1; i < config.data.length; i++) {
			expect(config.data[i - 1].value).toBeGreaterThanOrEqual(config.data[i].value);
		}
	});

	it('limits data to custom topN', () => {
		const many = makeSampleData(25);
		const config = createTopTracksChart(many, 7);
		expect(config.data).toHaveLength(7);
		expect(config.options?.topN).toBe(7);
	});

	it('handles empty data', () => {
		const config = createTopTracksChart(EMPTY_DATA);
		assertValidConfig(config);
		expect(config.data).toHaveLength(0);
	});

	it('all data points are tooltip-ready', () => {
		const config = createTopTracksChart(SAMPLE_3);
		assertAllPointsValid(config.data);
	});

	it('does not mutate the input array', () => {
		const input = [...SAMPLE_3];
		const originalOrder = input.map((d) => d.label);
		createTopTracksChart(input);
		expect(input.map((d) => d.label)).toEqual(originalOrder);
	});
});

// ---------------------------------------------------------------------------
// createActivityOverTimeChart
// ---------------------------------------------------------------------------

describe('createActivityOverTimeChart', () => {
	it('returns a valid line chart config', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		assertValidConfig(config);
		expect(config.type).toBe('line');
	});

	it('sets title to "Listening Activity Over Time"', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		expect(config.title).toBe('Listening Activity Over Time');
	});

	it('sets axis labels for time series', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		expect(config.xLabel).toBe('Date');
		expect(config.yLabel).toBe('Plays');
	});

	it('preserves data order (no sorting applied)', () => {
		const timeData: ChartDataPoint[] = [
			{ label: '2024-01', value: 5 },
			{ label: '2024-02', value: 15 },
			{ label: '2024-03', value: 8 },
		];
		const config = createActivityOverTimeChart(timeData);
		expect(config.data.map((d) => d.label)).toEqual(['2024-01', '2024-02', '2024-03']);
	});

	it('does not apply topN (no options set)', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		expect(config.options).toBeUndefined();
	});

	it('handles empty data', () => {
		const config = createActivityOverTimeChart(EMPTY_DATA);
		assertValidConfig(config);
		expect(config.data).toHaveLength(0);
	});

	it('handles single data point', () => {
		const config = createActivityOverTimeChart(SINGLE_POINT);
		expect(config.data).toHaveLength(1);
	});

	it('all data points are tooltip-ready', () => {
		const config = createActivityOverTimeChart(makeSampleData(50));
		assertAllPointsValid(config.data);
	});
});

// ---------------------------------------------------------------------------
// createGenreDistributionChart
// ---------------------------------------------------------------------------

describe('createGenreDistributionChart', () => {
	it('returns a valid donut chart config', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		assertValidConfig(config);
		expect(config.type).toBe('donut');
	});

	it('sets title to "Genre Distribution"', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		expect(config.title).toBe('Genre Distribution');
	});

	it('does not set axis labels (pie/donut has none)', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		expect(config.xLabel).toBeUndefined();
		expect(config.yLabel).toBeUndefined();
	});

	it('limits to top 8 genres by default', () => {
		const manyGenres = makeSampleData(15);
		const config = createGenreDistributionChart(manyGenres);
		expect(config.data).toHaveLength(8);
		expect(config.options?.topN).toBe(8);
	});

	it('returns all items when fewer than 8', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		expect(config.data).toHaveLength(3);
	});

	it('sorts data descending by value', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		for (let i = 1; i < config.data.length; i++) {
			expect(config.data[i - 1].value).toBeGreaterThanOrEqual(config.data[i].value);
		}
	});

	it('handles empty data', () => {
		const config = createGenreDistributionChart(EMPTY_DATA);
		assertValidConfig(config);
		expect(config.data).toHaveLength(0);
	});

	it('all data points are tooltip-ready', () => {
		const config = createGenreDistributionChart(makeSampleData(12));
		assertAllPointsValid(config.data);
	});

	it('does not mutate the input array', () => {
		const input = [...SAMPLE_3];
		const originalOrder = input.map((d) => d.label);
		createGenreDistributionChart(input);
		expect(input.map((d) => d.label)).toEqual(originalOrder);
	});
});

// ---------------------------------------------------------------------------
// createReleaseYearChart
// ---------------------------------------------------------------------------

describe('createReleaseYearChart', () => {
	const yearData: ChartDataPoint[] = [
		{ label: '2022', value: 15 },
		{ label: '2020', value: 8 },
		{ label: '2023', value: 22 },
		{ label: '2019', value: 5 },
	];

	it('returns a valid histogram chart config', () => {
		const config = createReleaseYearChart(yearData);
		assertValidConfig(config);
		expect(config.type).toBe('histogram');
	});

	it('sets title to "Tracks by Release Year"', () => {
		const config = createReleaseYearChart(yearData);
		expect(config.title).toBe('Tracks by Release Year');
	});

	it('sets axis labels for year histogram', () => {
		const config = createReleaseYearChart(yearData);
		expect(config.xLabel).toBe('Year');
		expect(config.yLabel).toBe('Tracks');
	});

	it('sorts data by label ascending (chronological)', () => {
		const config = createReleaseYearChart(yearData);
		const labels = config.data.map((d) => d.label);
		expect(labels).toEqual(['2019', '2020', '2022', '2023']);
	});

	it('does not apply topN (no options set)', () => {
		const config = createReleaseYearChart(yearData);
		expect(config.options).toBeUndefined();
	});

	it('handles empty data', () => {
		const config = createReleaseYearChart(EMPTY_DATA);
		assertValidConfig(config);
		expect(config.data).toHaveLength(0);
	});

	it('handles single year', () => {
		const config = createReleaseYearChart([{ label: '2024', value: 100 }]);
		expect(config.data).toHaveLength(1);
		expect(config.data[0].label).toBe('2024');
	});

	it('all data points are tooltip-ready', () => {
		const config = createReleaseYearChart(yearData);
		assertAllPointsValid(config.data);
	});

	it('does not mutate the input array', () => {
		const input = [...yearData];
		const originalOrder = input.map((d) => d.label);
		createReleaseYearChart(input);
		expect(input.map((d) => d.label)).toEqual(originalOrder);
	});
});

// ---------------------------------------------------------------------------
// Cross-cutting: sorting stability and edge cases
// ---------------------------------------------------------------------------

describe('sorting edge cases', () => {
	it('handles items with equal values (stable sort)', () => {
		const equalData: ChartDataPoint[] = [
			{ label: 'X', value: 10 },
			{ label: 'Y', value: 10 },
			{ label: 'Z', value: 10 },
		];
		const config = createTopArtistsChart(equalData);
		expect(config.data).toHaveLength(3);
		assertAllPointsValid(config.data);
	});

	it('handles zero values', () => {
		const zeroData: ChartDataPoint[] = [
			{ label: 'A', value: 0 },
			{ label: 'B', value: 5 },
			{ label: 'C', value: 0 },
		];
		const config = createTopTracksChart(zeroData);
		expect(config.data[0].value).toBe(5);
		expect(config.data[1].value).toBe(0);
		expect(config.data[2].value).toBe(0);
	});

	it('handles large datasets efficiently', () => {
		const large = makeSampleData(1000);
		const config = createTopArtistsChart(large, 10);
		expect(config.data).toHaveLength(10);
		expect(config.data[0].value).toBe(10000);
	});

	it('topN of 1 returns only the highest value', () => {
		const config = createTopArtistsChart(SAMPLE_3, 1);
		expect(config.data).toHaveLength(1);
		expect(config.data[0].label).toBe('Beta');
		expect(config.data[0].value).toBe(50);
	});
});

// ---------------------------------------------------------------------------
// ChartContainer routing logic (tested via config structure)
// ---------------------------------------------------------------------------

describe('ChartContainer type routing', () => {
	it('bar config has type "bar" for BarChart routing', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		expect(config.type).toBe('bar');
	});

	it('line config has type "line" for LineChart routing', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		expect(config.type).toBe('line');
	});

	it('donut config routes to PieChart (pie or donut)', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		expect(['pie', 'donut']).toContain(config.type);
	});

	it('histogram config has type "histogram" for HistogramChart routing', () => {
		const config = createReleaseYearChart(SAMPLE_3);
		expect(config.type).toBe('histogram');
	});

	it('empty data config still has correct type for empty-state rendering', () => {
		const bar = createTopArtistsChart(EMPTY_DATA);
		const line = createActivityOverTimeChart(EMPTY_DATA);
		const donut = createGenreDistributionChart(EMPTY_DATA);
		const hist = createReleaseYearChart(EMPTY_DATA);

		expect(bar.type).toBe('bar');
		expect(line.type).toBe('line');
		expect(donut.type).toBe('donut');
		expect(hist.type).toBe('histogram');
	});

	it('all config types are recognized ChartType values', () => {
		const configs = [
			createTopArtistsChart(SAMPLE_3),
			createTopTracksChart(SAMPLE_3),
			createActivityOverTimeChart(SAMPLE_3),
			createGenreDistributionChart(SAMPLE_3),
			createReleaseYearChart(SAMPLE_3),
		];
		for (const config of configs) {
			expect(VALID_CHART_TYPES).toContain(config.type);
		}
	});
});

// ---------------------------------------------------------------------------
// Tooltip data structure validation
// ---------------------------------------------------------------------------

describe('tooltip data structure', () => {
	it('bar chart data has label and value for tooltip rendering', () => {
		const config = createTopArtistsChart(SAMPLE_3);
		for (const point of config.data) {
			expect(point).toHaveProperty('label');
			expect(point).toHaveProperty('value');
		}
	});

	it('line chart data has label and value for tooltip rendering', () => {
		const config = createActivityOverTimeChart(SAMPLE_3);
		for (const point of config.data) {
			expect(point).toHaveProperty('label');
			expect(point).toHaveProperty('value');
		}
	});

	it('pie/donut chart data supports percentage calculation', () => {
		const config = createGenreDistributionChart(SAMPLE_3);
		const total = config.data.reduce((sum, d) => sum + d.value, 0);
		expect(total).toBeGreaterThan(0);
		for (const point of config.data) {
			const pct = Math.round((point.value / total) * 100);
			expect(pct).toBeGreaterThanOrEqual(0);
			expect(pct).toBeLessThanOrEqual(100);
		}
	});

	it('histogram chart data has label and value for tooltip rendering', () => {
		const yearData: ChartDataPoint[] = [
			{ label: '2020', value: 10 },
			{ label: '2021', value: 20 },
		];
		const config = createReleaseYearChart(yearData);
		for (const point of config.data) {
			expect(point).toHaveProperty('label');
			expect(point).toHaveProperty('value');
		}
	});
});
