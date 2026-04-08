<script lang="ts">
	import { auth, isAuthenticated } from '$lib/stores/auth';
</script>

<div class="flex flex-col items-center justify-center py-20">
	<h1 class="mb-4 text-4xl font-bold text-green-400">Spotify Helper</h1>
	<p class="mb-8 text-lg text-gray-400">
		Search, analyze, and explore your Spotify library.
	</p>

	{#if $isAuthenticated}
		<div class="flex gap-4">
			<a
				href="/search"
				class="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500"
			>
				Search
			</a>
			<a
				href="/analytics"
				class="rounded-lg border border-gray-600 px-6 py-3 font-medium text-gray-300 hover:border-gray-400 hover:text-white"
			>
				Analytics
			</a>
			<button
				on:click={() => auth.logout()}
				class="rounded-lg border border-gray-600 px-6 py-3 font-medium text-gray-300 hover:border-red-400 hover:text-red-400"
			>
				Log out
			</button>
		</div>
	{:else}
		<button
			on:click={() => auth.login()}
			class="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-500"
		>
			Connect with Spotify
		</button>
	{/if}
</div>
