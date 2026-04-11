import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5174,
		host: '127.0.0.1',
		fs: {
			allow: ['../..']
		}
	},
	assetsInclude: ['**/*.wasm'],
	optimizeDeps: {
		exclude: ['wa-sqlite']
	},
	worker: {
		format: 'es'
	},
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['tests/unit/setup.ts']
	}
});
