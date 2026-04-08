<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';

	let status = 'Processing authentication...';
	let error = '';

	onMount(async () => {
		const params = $page.url.searchParams;
		const code = params.get('code');
		const state = params.get('state');
		const errorParam = params.get('error');

		if (errorParam) {
			error = `Spotify denied access: ${errorParam}`;
			status = '';
			return;
		}

		if (!code || !state) {
			error = 'Missing code or state parameter';
			status = '';
			return;
		}

		try {
			await auth.handleCallback(code, state);
			goto('/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Authentication failed';
			status = '';
		}
	});
</script>

<div class="flex flex-col items-center justify-center py-20">
	{#if status}
		<p class="text-lg text-gray-400">{status}</p>
	{/if}
	{#if error}
		<p class="text-lg text-red-400">{error}</p>
		<a href="/" class="mt-4 text-green-400 hover:underline">Back to home</a>
	{/if}
</div>
