<script lang="ts">
	export let message: string;
	export let onretry: (() => void) | null = null;
</script>

<div class="rounded-xl border border-red-800 bg-red-950/50 p-6 text-center">
	<p class="text-lg font-semibold text-red-400">Something went wrong</p>
	<p class="mt-2 text-sm text-gray-400">{message}</p>
	{#if onretry}
		<button
			onclick={onretry}
			class="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
		>
			Try Again
		</button>
	{/if}
</div>
