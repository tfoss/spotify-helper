<script lang="ts">
	export let lines: number = 3;
	export let showChart: boolean = false;
</script>

<div class="animate-pulse space-y-4">
	{#if showChart}
		<div class="grid gap-6 lg:grid-cols-2">
			<div class="space-y-3">
				{#each Array(lines) as _}
					<div class="flex items-center gap-3 rounded-lg bg-gray-100 p-3 dark:bg-gray-900">
						<div class="h-4 w-8 rounded bg-gray-200 dark:bg-gray-800"></div>
						<div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-800"></div>
						<div class="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-800"></div>
					</div>
				{/each}
			</div>
			<div class="rounded-xl border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-900">
				<div class="mb-3 h-5 w-32 rounded bg-gray-200 dark:bg-gray-800"></div>
				<div class="h-64 rounded bg-gray-200/50 dark:bg-gray-800/50"></div>
			</div>
		</div>
	{:else}
		{#each Array(lines) as _}
			<div class="flex items-center gap-3 rounded-lg bg-gray-100 p-3 dark:bg-gray-900">
				<div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-800"></div>
			</div>
		{/each}
	{/if}
</div>
