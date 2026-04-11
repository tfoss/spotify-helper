/**
 * Smoke test: validate wa-sqlite import paths resolve correctly.
 *
 * These tests catch broken imports before they reach the browser by:
 * 1. Verifying the package is installed via Node module resolution
 * 2. Checking all import paths from worker.ts resolve to real files
 * 3. Verifying the WASM binary exists alongside the MJS loader
 * 4. Using require.resolve() which mirrors how bundlers find modules
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * The exact import specifiers used in src/lib/db/worker.ts.
 * If you change an import there, update this list to match.
 */
const WORKER_IMPORTS = {
	factory: 'wa-sqlite/dist/wa-sqlite-async.mjs',
	api: 'wa-sqlite',
	vfs: 'wa-sqlite/src/examples/AccessHandlePoolVFS.js',
};

describe('wa-sqlite import resolution', () => {
	it('wa-sqlite package can be resolved by Node', () => {
		const resolved = require.resolve('wa-sqlite');
		expect(resolved).toBeTruthy();
		expect(existsSync(resolved)).toBe(true);
	});

	it('factory import resolves: wa-sqlite/dist/wa-sqlite-async.mjs', () => {
		const resolved = require.resolve(WORKER_IMPORTS.factory);
		expect(resolved).toBeTruthy();
		expect(existsSync(resolved)).toBe(true);
		expect(resolved).toContain('wa-sqlite-async.mjs');
	});

	it('VFS import resolves: wa-sqlite/src/examples/AccessHandlePoolVFS.js', () => {
		const resolved = require.resolve(WORKER_IMPORTS.vfs);
		expect(resolved).toBeTruthy();
		expect(existsSync(resolved)).toBe(true);
		expect(resolved).toContain('AccessHandlePoolVFS.js');
	});

	it('WASM binary exists next to the MJS factory', () => {
		const mjsPath = require.resolve(WORKER_IMPORTS.factory);
		const wasmPath = mjsPath.replace(/\.mjs$/, '.wasm');
		expect(existsSync(wasmPath)).toBe(true);
	});

	it('wa-sqlite/dist/ contains both sync and async builds', () => {
		const asyncMjs = require.resolve('wa-sqlite/dist/wa-sqlite-async.mjs');
		const syncMjs = require.resolve('wa-sqlite/dist/wa-sqlite.mjs');
		expect(existsSync(asyncMjs)).toBe(true);
		expect(existsSync(syncMjs)).toBe(true);
	});

	it('worker.ts import paths match installed package structure', () => {
		// This test fails if wa-sqlite updates and renames/removes files
		for (const [name, specifier] of Object.entries(WORKER_IMPORTS)) {
			const resolved = require.resolve(specifier);
			expect(existsSync(resolved), `${name}: ${specifier} did not resolve`).toBe(true);
		}
	});
});
