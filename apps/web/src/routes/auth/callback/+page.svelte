<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authStore } from '$lib/stores/auth';

	let status = $state<'processing' | 'error'>('processing');
	let errorMessage = $state('');

	onMount(async () => {
		const url = $page.url;
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const error = url.searchParams.get('error');

		if (error) {
			status = 'error';
			errorMessage = error === 'access_denied'
				? 'Access was denied. Please try logging in again.'
				: `Spotify returned an error: ${error}`;
			return;
		}

		if (!code || !state) {
			status = 'error';
			errorMessage = 'Missing authorization code or state parameter.';
			return;
		}

		await authStore.handleCallback(code, state);

		// Check if handleCallback set an error
		let currentError: string | null = null;
		const unsubscribe = authStore.subscribe((s) => {
			currentError = s.error;
		});
		unsubscribe();

		if (currentError) {
			status = 'error';
			errorMessage = currentError;
		} else {
			goto('/');
		}
	});
</script>

<div class="flex flex-col items-center justify-center py-20">
	{#if status === 'processing'}
		<div class="flex flex-col items-center gap-4">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-green-400 border-t-transparent"></div>
			<p class="text-lg text-gray-600 dark:text-gray-400">Connecting to Spotify...</p>
		</div>
	{:else}
		<div class="max-w-md text-center">
			<h1 class="mb-4 text-2xl font-bold text-red-400">Authentication Failed</h1>
			<p class="mb-6 text-gray-600 dark:text-gray-400">{errorMessage}</p>
			<a
				href="/"
				class="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
			>
				Back to Home
			</a>
		</div>
	{/if}
</div>
