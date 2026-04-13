/**
 * Tests for chart data export utilities.
 *
 * Covers chartDataToCsv and chartDataToJson; downloadBlob is a browser-side
 * side-effecting function and is not tested here.
 */

import { describe, it, expect } from 'vitest';
import { chartDataToCsv, chartDataToJson } from '../../../src/lib/charts/export';
import type { ChartConfig } from '../../../src/lib/charts/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
	return {
		type: 'bar',
		title: 'Top Artists',
		data: [
			{ label: 'Queen', value: 90 },
			{ label: 'The Beatles', value: 85 },
			{ label: 'Led Zeppelin', value: 80 },
		],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// chartDataToCsv
// ---------------------------------------------------------------------------

describe('chartDataToCsv', () => {
	it('includes a header row with Label and Value columns', () => {
		const csv = chartDataToCsv(makeConfig());
		const lines = csv.trim().split('\n');
		expect(lines[0]).toBe('Label,Value');
	});

	it('produces one data row per data point', () => {
		const config = makeConfig();
		const csv = chartDataToCsv(config);
		const lines = csv.trim().split('\n');
		// header + 3 data rows
		expect(lines).toHaveLength(4);
	});

	it('each row has the correct label and value', () => {
		const config = makeConfig();
		const csv = chartDataToCsv(config);
		const lines = csv.trim().split('\n');
		expect(lines[1]).toBe('Queen,90');
		expect(lines[2]).toBe('The Beatles,85');
		expect(lines[3]).toBe('Led Zeppelin,80');
	});

	it('returns header-only row for empty data', () => {
		const config = makeConfig({ data: [] });
		const csv = chartDataToCsv(config);
		expect(csv).toBe('Label,Value\n');
	});

	it('escapes labels containing commas', () => {
		const config = makeConfig({
			data: [{ label: 'Rock, Pop', value: 10 }],
		});
		const csv = chartDataToCsv(config);
		const lines = csv.trim().split('\n');
		expect(lines[1]).toBe('"Rock, Pop",10');
	});

	it('escapes labels containing double quotes', () => {
		const config = makeConfig({
			data: [{ label: 'He said "hello"', value: 5 }],
		});
		const csv = chartDataToCsv(config);
		expect(csv).toContain('"He said ""hello"""');
	});

	it('includes metadata columns when present', () => {
		const config = makeConfig({
			data: [
				{ label: 'Queen', value: 90, metadata: { genre: 'Rock', country: 'UK' } },
			],
		});
		const csv = chartDataToCsv(config);
		const lines = csv.trim().split('\n');
		// Metadata keys sorted alphabetically: country, genre
		expect(lines[0]).toBe('Label,Value,country,genre');
		expect(lines[1]).toBe('Queen,90,UK,Rock');
	});

	it('fills empty metadata cells for points missing a key', () => {
		const config = makeConfig({
			data: [
				{ label: 'Queen', value: 90, metadata: { genre: 'Rock' } },
				{ label: 'Bach', value: 70 }, // no metadata
			],
		});
		const csv = chartDataToCsv(config);
		const lines = csv.trim().split('\n');
		expect(lines[0]).toBe('Label,Value,genre');
		expect(lines[1]).toBe('Queen,90,Rock');
		expect(lines[2]).toBe('Bach,70,');
	});
});

// ---------------------------------------------------------------------------
// chartDataToJson
// ---------------------------------------------------------------------------

describe('chartDataToJson', () => {
	it('returns valid JSON', () => {
		const config = makeConfig();
		expect(() => JSON.parse(chartDataToJson(config))).not.toThrow();
	});

	it('JSON matches chart data — same length as data array', () => {
		const config = makeConfig();
		const parsed = JSON.parse(chartDataToJson(config)) as unknown[];
		expect(parsed).toHaveLength(config.data.length);
	});

	it('each JSON object has label and value fields', () => {
		const config = makeConfig();
		const parsed = JSON.parse(chartDataToJson(config)) as { label: string; value: number }[];
		for (const item of parsed) {
			expect(typeof item.label).toBe('string');
			expect(typeof item.value).toBe('number');
		}
	});

	it('JSON values match the original data', () => {
		const config = makeConfig();
		const parsed = JSON.parse(chartDataToJson(config)) as { label: string; value: number }[];
		expect(parsed[0]).toMatchObject({ label: 'Queen', value: 90 });
		expect(parsed[1]).toMatchObject({ label: 'The Beatles', value: 85 });
	});

	it('returns empty array JSON for empty data', () => {
		const config = makeConfig({ data: [] });
		const parsed = JSON.parse(chartDataToJson(config));
		expect(parsed).toEqual([]);
	});

	it('metadata fields are flattened to top level', () => {
		const config = makeConfig({
			data: [{ label: 'Queen', value: 90, metadata: { genre: 'Rock' } }],
		});
		const parsed = JSON.parse(chartDataToJson(config)) as { label: string; value: number; genre: string }[];
		expect(parsed[0].genre).toBe('Rock');
		expect(parsed[0]).not.toHaveProperty('metadata');
	});
});
