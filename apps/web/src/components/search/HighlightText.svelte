<script lang="ts">
	import { highlightMatches } from '$lib/search/highlight';

	interface Props {
		text: string;
		query: string;
	}

	let { text, query }: Props = $props();

	let segments = $derived(highlightMatches(text, query));
</script>

{#each segments as segment}
	{#if segment.highlighted}
		<mark class="rounded bg-green-900/50 px-0.5 text-green-300">{segment.text}</mark>
	{:else}
		{segment.text}
	{/if}
{/each}
