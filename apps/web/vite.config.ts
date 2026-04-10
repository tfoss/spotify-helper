import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5174,
		host: '127.0.0.1'
	},
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['tests/unit/setup.ts']
	}
});
