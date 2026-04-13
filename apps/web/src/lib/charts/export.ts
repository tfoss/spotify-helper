/**
 * Chart data export utilities.
 *
 * Pure functions for serialising ChartConfig data to CSV and JSON,
 * plus browser-side download helpers. All functions are side-effect-free
 * except `downloadBlob`, which triggers a browser file download.
 */

import type { ChartConfig, ChartDataPoint } from './types';

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * Serialise chart data points to a CSV string.
 *
 * Produces two columns: Label and Value. Any additional `metadata` fields
 * are appended as extra columns in alphabetical key order.
 *
 * @param config - The chart configuration to export.
 * @returns A CSV string including a header row.
 */
export function chartDataToCsv(config: ChartConfig): string {
	if (config.data.length === 0) return 'Label,Value\n';

	// Collect all metadata keys present across data points
	const metaKeys = collectMetaKeys(config.data);

	const header = ['Label', 'Value', ...metaKeys].map(csvEscape).join(',');
	const rows = config.data.map((point) => {
		const base = [csvEscape(point.label), String(point.value)];
		const meta = metaKeys.map((k) => csvEscape(String(point.metadata?.[k] ?? '')));
		return [...base, ...meta].join(',');
	});

	return [header, ...rows].join('\n') + '\n';
}

/**
 * Serialise chart data points to a pretty-printed JSON string.
 *
 * Each element in the output array has `label` and `value` fields, plus
 * any `metadata` fields flattened to the top level.
 *
 * @param config - The chart configuration to export.
 * @returns A JSON string (array of objects).
 */
export function chartDataToJson(config: ChartConfig): string {
	const objects = config.data.map((point) => ({
		label: point.label,
		value: point.value,
		...(point.metadata ?? {}),
	}));
	return JSON.stringify(objects, null, 2);
}

// ---------------------------------------------------------------------------
// Browser download
// ---------------------------------------------------------------------------

/**
 * Trigger a browser file download for the given content.
 *
 * Creates a temporary `<a>` element, clicks it, then removes it.
 * This is a side-effecting function and is not testable in Node environments.
 *
 * @param content  - The file content string.
 * @param filename - The suggested filename for the download dialog.
 * @param mimeType - MIME type of the content (e.g. `"text/csv"`).
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Download a chart's data as a CSV file.
 *
 * The filename is derived from the chart title; spaces are replaced with
 * underscores and the result is lowercased.
 *
 * @param config - The chart configuration to export.
 */
export function downloadChartAsCsv(config: ChartConfig): void {
	const csv = chartDataToCsv(config);
	const filename = `${slugify(config.title)}.csv`;
	downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Download a chart's data as a JSON file.
 *
 * @param config - The chart configuration to export.
 */
export function downloadChartAsJson(config: ChartConfig): void {
	const json = chartDataToJson(config);
	const filename = `${slugify(config.title)}.json`;
	downloadBlob(json, filename, 'application/json');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collect all unique metadata keys across data points, sorted alphabetically.
 */
function collectMetaKeys(data: ChartDataPoint[]): string[] {
	const keys = new Set<string>();
	for (const point of data) {
		if (point.metadata) {
			for (const k of Object.keys(point.metadata)) {
				keys.add(k);
			}
		}
	}
	return [...keys].sort();
}

/**
 * Escape a string for CSV output: wrap in quotes and double any internal quotes.
 */
function csvEscape(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Convert a chart title to a safe filename slug (lowercase, underscores).
 */
function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}
