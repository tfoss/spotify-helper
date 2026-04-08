<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { search } from '$lib/stores/search';
	import SearchResults from './SearchResults.svelte';
	import type { SearchMode } from '$lib/search/types';
	import type { DbExecutor } from '$lib/db/types';

	export let exec: DbExecutor | null = null;

	let open = false;
	let inputEl: HTMLInputElement;
	let query = '';
	let mode: SearchMode = 'track';

	function openPalette() {
		open = true;
		setTimeout(() => inputEl?.focus(), 0);
	}

	function closePalette() {
		open = false;
		query = '';
		search.clearSearch();
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open ? closePalette() : openPalette();
		}
		if (e.key === 'Escape' && open) {
			closePalette();
		}
	}

	function handleInput() {
		if (!exec) return;
		search.performSearch({ query, mode }, exec);
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) closePalette();
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20"
		on:click={handleOverlayClick}
	>
		<div class="w-full max-w-2xl rounded-xl bg-gray-900 shadow-2xl ring-1 ring-white/10">
			<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
				<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					on:input={handleInput}
					type="text"
					placeholder="Search your playlists..."
					class="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
				/>
				<select
					bind:value={mode}
					on:change={handleInput}
					class="rounded bg-gray-800 px-2 py-1 text-sm text-gray-300 outline-none"
				>
					<option value="track">Track</option>
					<option value="artist">Artist</option>
					<option value="both">Both</option>
				</select>
				<kbd class="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">ESC</kbd>
			</div>
			<div class="max-h-96 overflow-y-auto p-2">
				<SearchResults results={$search.results} isSearching={$search.isSearching} error={$search.error} />
			</div>
		</div>
	</div>
{/if}
