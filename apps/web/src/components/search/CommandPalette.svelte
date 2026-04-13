<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth';
	import { dbStore } from '$lib/stores/db';
	import { syncStore } from '$lib/stores/sync';
	import { SpotifyClient } from '$lib/spotify/client';
	import { search } from '$lib/stores/search';
	import { PALETTE_COMMANDS, filterCommands, isPaletteToggleEvent } from '$lib/palette/commands';
	import SearchResults from './SearchResults.svelte';
	import type { SearchMode } from '$lib/search/types';

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let open = $state(false);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);
	let query = $state('');
	let mode = $state<SearchMode>('track');
	let selectedNavIndex = $state(-1);

	// ---------------------------------------------------------------------------
	// Commands — map command IDs to runtime actions
	// ---------------------------------------------------------------------------

	const commandActions: Record<string, () => void> = {
		'nav:search': () => navigate('/search'),
		'nav:analytics': () => navigate('/analytics'),
		'action:sync': () => triggerSync(),
	};

	let filteredCommands = $derived(filterCommands(PALETTE_COMMANDS, query));

	let showNavCommands = $derived(filteredCommands.length > 0 && !$search.results);

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	function navigate(path: string) {
		closePalette();
		goto(path);
	}

	function triggerSync() {
		closePalette();
		const auth = get(authStore);
		const db = get(dbStore);
		if (!auth.isAuthenticated || !auth.accessToken || !db.isReady || !db.executor) return;
		const client = new SpotifyClient(
			() => get(authStore).accessToken,
			() => authStore.refreshAccessToken(),
		);
		syncStore.startSync(client, db.executor);
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

	// ---------------------------------------------------------------------------
	// Search
	// ---------------------------------------------------------------------------

	function handleInput() {
		selectedNavIndex = -1;
		const { executor } = get(dbStore);
		if (!executor || !query.trim()) {
			search.clearSearch();
			return;
		}
		search.performSearch({ query, mode }, executor);
	}

	// ---------------------------------------------------------------------------
	// Keyboard
	// ---------------------------------------------------------------------------

	function handleKeydown(e: KeyboardEvent) {
		if (isPaletteToggleEvent(e)) {
			e.preventDefault();
			open ? closePalette() : openPalette();
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') {
			closePalette();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedNavIndex = Math.min(selectedNavIndex + 1, filteredCommands.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedNavIndex = Math.max(selectedNavIndex - 1, -1);
		} else if (e.key === 'Enter' && selectedNavIndex >= 0) {
			e.preventDefault();
			commandActions[filteredCommands[selectedNavIndex].id]?.();
		}
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
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[15vh] sm:pt-20"
		onclick={handleOverlayClick}
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
					oninput={handleInput}
					type="text"
					placeholder="Search or type a command..."
					class="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
				/>
				<select
					bind:value={mode}
					onchange={handleInput}
					class="hidden rounded bg-gray-800 px-2 py-1 text-sm text-gray-300 outline-none sm:block"
				>
					<option value="track">Track</option>
					<option value="artist">Artist</option>
					<option value="both">Both</option>
				</select>
				<kbd class="hidden rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400 sm:inline">ESC</kbd>
			</div>

			<div class="max-h-[60vh] overflow-y-auto p-2 sm:max-h-96">
				{#if showNavCommands}
					<div class="mb-2">
						<p class="px-2 pb-1 text-xs font-medium uppercase text-gray-500">Commands</p>
						{#each filteredCommands as cmd, i}
							<button
								class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-800 {i === selectedNavIndex ? 'bg-gray-800 text-white' : 'text-gray-300'}"
								onclick={() => commandActions[cmd.id]?.()}
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
					<SearchResults
						results={$search.results}
						isSearching={$search.isSearching}
						error={$search.error}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}
