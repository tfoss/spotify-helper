<script lang="ts">
	import type { TimeRange } from '$lib/analytics/types';

	interface Props {
		value: TimeRange;
		onchange: (range: TimeRange) => void;
	}

	let { value, onchange }: Props = $props();

	const options: { value: TimeRange; label: string }[] = [
		{ value: 'short_term', label: 'Last 4 Weeks' },
		{ value: 'medium_term', label: 'Last 6 Months' },
		{ value: 'long_term', label: 'All Time' },
	];
</script>

<div class="flex gap-1 rounded-lg bg-gray-800 p-1">
	{#each options as option}
		<button
			class="rounded-md px-4 py-2 text-sm font-medium transition-colors {value === option.value
				? 'bg-green-600 text-white'
				: 'text-gray-400 hover:text-white'}"
			onclick={() => onchange(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
