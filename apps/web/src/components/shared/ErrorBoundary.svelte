<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props();
	let hasError = $state(false);
	let errorMessage = $state('');

	function handleError(event: ErrorEvent) {
		hasError = true;
		errorMessage = event.message || 'An unexpected error occurred';
		event.preventDefault();
	}

	function reset() {
		hasError = false;
		errorMessage = '';
	}

	onMount(() => {
		window.addEventListener('error', handleError);
		return () => window.removeEventListener('error', handleError);
	});
</script>

{#if hasError}
	<div class="rounded-xl border border-red-800 bg-red-950/50 p-8 text-center">
		<p class="text-lg font-semibold text-red-400">Something went wrong</p>
		<p class="mt-2 text-sm text-gray-400">{errorMessage}</p>
		<button
			onclick={reset}
			class="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
		>
			Try Again
		</button>
	</div>
{:else}
	{@render children()}
{/if}
