/**
 * Smoke test: validate that wa-sqlite import paths resolve to real files.
 *
 * All other DB tests mock DbClient and never load wa-sqlite. This test
 * ensures the actual import paths in worker.ts point to files that exist
 * in the installed wa-sqlite package — catching broken imports before
 * they reach the browser.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { existsSync } from 'fs';

/**
 * The import paths used in src/lib/db/worker.ts.
 * If you change an import there, update this list.
 */
const WORKER_IMPORT_PATHS = [
	'wa-sqlite/dist/wa-sqlite-async.mjs',
	'wa-sqlite/src/examples/AccessHandlePoolVFS.js',
];

/**
 * Resolve a bare module specifier to an absolute path in node_modules.
 * Walks up from the web app directory to find the package (handles hoisting).
 */
function resolveModulePath(specifier: string): string | null {
	const parts = specifier.split('/');
	const pkgName = parts[0];
	const subpath = parts.slice(1).join('/');

	// Check local node_modules first, then hoisted
	const searchDirs = [
		resolve(__dirname, '../../../node_modules'),
		resolve(__dirname, '../../../../node_modules'),
		resolve(__dirname, '../../../../../node_modules'),
	];

	for (const dir of searchDirs) {
		const fullPath = resolve(dir, pkgName, subpath);
		if (existsSync(fullPath)) return fullPath;
	}

	return null;
}

describe('wa-sqlite import paths resolve', () => {
	it('wa-sqlite package is installed', () => {
		const searchDirs = [
			resolve(__dirname, '../../../node_modules/wa-sqlite'),
			resolve(__dirname, '../../../../node_modules/wa-sqlite'),
			resolve(__dirname, '../../../../../node_modules/wa-sqlite'),
		];

		const found = searchDirs.some((dir) => existsSync(dir));
		expect(found).toBe(true);
	});

	for (const importPath of WORKER_IMPORT_PATHS) {
		it(`"${importPath}" resolves to an existing file`, () => {
			const resolved = resolveModulePath(importPath);
			expect(resolved).not.toBeNull();
			expect(existsSync(resolved!)).toBe(true);
		});
	}

	it('wa-sqlite main module resolves', () => {
		const searchDirs = [
			resolve(__dirname, '../../../node_modules/wa-sqlite/src/sqlite-api.js'),
			resolve(__dirname, '../../../../node_modules/wa-sqlite/src/sqlite-api.js'),
			resolve(__dirname, '../../../../../node_modules/wa-sqlite/src/sqlite-api.js'),
		];

		const found = searchDirs.some((dir) => existsSync(dir));
		expect(found).toBe(true);
	});

	it('wa-sqlite async WASM file exists alongside the MJS', () => {
		const resolved = resolveModulePath('wa-sqlite/dist/wa-sqlite-async.wasm');
		expect(resolved).not.toBeNull();
		expect(existsSync(resolved!)).toBe(true);
	});
});
