<script lang="ts">
	export let icon: string = '📭';
	export let title: string;
	export let description: string = '';
	export let actionLabel: string = '';
	export let onaction: (() => void) | null = null;
</script>

<div class="py-16 text-center">
	<p class="text-3xl">{icon}</p>
	<p class="mt-3 text-lg text-gray-600 dark:text-gray-400">{title}</p>
	{#if description}
		<p class="mt-1 text-sm text-gray-500 dark:text-gray-600">{description}</p>
	{/if}
	{#if actionLabel && onaction}
		<button
			onclick={onaction}
			class="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
		>
			{actionLabel}
		</button>
	{/if}
</div>
