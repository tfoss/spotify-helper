export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'histogram';

export interface ChartConfig {
	type: ChartType;
	title: string;
	xLabel?: string;
	yLabel?: string;
	data: ChartDataPoint[];
	options?: {
		topN?: number;
		sortDirection?: 'asc' | 'desc';
		colorScheme?: string;
	};
}

export interface ChartDataPoint {
	label: string;
	value: number;
	metadata?: Record<string, unknown>;
}
