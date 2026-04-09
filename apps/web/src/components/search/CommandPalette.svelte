<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { search } from '$lib/stores/search';
	import SearchResults from './SearchResults.svelte';
	import type { SearchMode } from '$lib/search/types';
	import type { DbExecutor } from '$lib/db/types';

	export let exec: DbExecutor | null = null;
	export let onSync: (() => void) | null = null;

	let open = false;
	let inputEl: HTMLInputElement;
	let query = '';
	let mode: SearchMode = 'track';
	let selectedNavIndex = -1;

	interface NavCommand {
		label: string;
		description: string;
		action: () => void;
		icon: string;
	}

	const navCommands: NavCommand[] = [
		{ label: 'Go to Search', description: 'Search your playlists', action: () => navigate('/search'), icon: '🔍' },
		{ label: 'Go to Analytics', description: 'View listening analytics', action: () => navigate('/analytics'), icon: '📊' },
		{ label: 'Sync Library', description: 'Sync playlists from Spotify', action: () => { closePalette(); onSync?.(); }, icon: '🔄' },
	];

	$: filteredNavCommands = query.trim()
		? navCommands.filter((cmd) => cmd.label.toLowerCase().includes(query.toLowerCase()))
		: navCommands;

	$: showNavCommands = filteredNavCommands.length > 0;

	function navigate(path: string) {
		closePalette();
		goto(path);
	}

	function openPalette() {
		open = true;
		selectedNavIndex = -1;
		setTimeout(() => inputEl?.focus(), 0);
	}

	function closePalette() {
		open = false;
		query = '';
		selectedNavIndex = -1;
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
		if (open && e.key === 'ArrowDown') {
			e.preventDefault();
			selectedNavIndex = Math.min(selectedNavIndex + 1, filteredNavCommands.length - 1);
		}
		if (open && e.key === 'ArrowUp') {
			e.preventDefault();
			selectedNavIndex = Math.max(selectedNavIndex - 1, -1);
		}
		if (open && e.key === 'Enter' && selectedNavIndex >= 0) {
			e.preventDefault();
			filteredNavCommands[selectedNavIndex].action();
		}
	}

	function handleInput() {
		selectedNavIndex = -1;
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
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[15vh] sm:pt-20"
		on:click={handleOverlayClick}
	>
		<div class="w-full max-w-2xl rounded-xl bg-gray-900 shadow-2xl ring-1 ring-white/10">
			<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
				<svg class="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					on:input={handleInput}
					type="text"
					placeholder="Search or type a command..."
					class="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
				/>
				<select
					bind:value={mode}
					on:change={handleInput}
					class="hidden rounded bg-gray-800 px-2 py-1 text-sm text-gray-300 outline-none sm:block"
				>
					<option value="track">Track</option>
					<option value="artist">Artist</option>
					<option value="both">Both</option>
				</select>
				<kbd class="hidden rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400 sm:inline">ESC</kbd>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-2 sm:max-h-96">
				{#if showNavCommands && !$search.results}
					<div class="mb-2">
						<p class="px-2 pb-1 text-xs font-medium uppercase text-gray-500">Commands</p>
						{#each filteredNavCommands as cmd, i}
							<button
								class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-800 {i === selectedNavIndex ? 'bg-gray-800 text-white' : 'text-gray-300'}"
								on:click={cmd.action}
							>
								<span class="text-base">{cmd.icon}</span>
								<div>
									<span class="font-medium">{cmd.label}</span>
									<span class="ml-2 text-gray-500">{cmd.description}</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}

				{#if query.trim()}
					<SearchResults results={$search.results} isSearching={$search.isSearching} error={$search.error} />
				{/if}
			</div>
		</div>
	</div>
{/if}
