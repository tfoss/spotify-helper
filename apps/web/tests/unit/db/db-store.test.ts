/**
 * Tests for the database store.
 *
 * Since DbClient depends on Web Workers and wa-sqlite (browser-only),
 * these tests mock the DbClient to verify the store's lifecycle logic:
 * initialization, executor provision, error handling, and cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// ---------------------------------------------------------------------------
// Mock DbClient before importing the store
// ---------------------------------------------------------------------------

const mockInit = vi.fn();
const mockClose = vi.fn();
const mockExec = vi.fn();
const mockToExecutor = vi.fn(() => mockExec);

vi.mock('../../../src/lib/db/client', () => ({
	DbClient: vi.fn().mockImplementation(() => ({
		init: mockInit,
		close: mockClose,
		toExecutor: mockToExecutor,
	})),
}));

// Import after mock is set up
const { dbStore } = await import('../../../src/lib/stores/db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to initial state between tests. */
async function resetStore(): Promise<void> {
	await dbStore.close();
	vi.clearAllMocks();
	mockToExecutor.mockReturnValue(mockExec);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dbStore', () => {
	beforeEach(async () => {
		await resetStore();
	});

	it('starts in a non-ready state', () => {
		const state = get(dbStore);
		expect(state.isReady).toBe(false);
		expect(state.executor).toBeNull();
		expect(state.error).toBeNull();
		expect(state.isInitializing).toBe(false);
	});

	it('initializes the database and provides an executor', async () => {
		mockInit.mockResolvedValueOnce(undefined);

		await dbStore.initialize();

		const state = get(dbStore);
		expect(state.isReady).toBe(true);
		expect(state.executor).toBe(mockExec);
		expect(state.error).toBeNull();
		expect(state.isInitializing).toBe(false);
		expect(mockInit).toHaveBeenCalledOnce();
		expect(mockToExecutor).toHaveBeenCalledOnce();
	});

	it('does not re-initialize if already ready', async () => {
		mockInit.mockResolvedValue(undefined);

		await dbStore.initialize();
		await dbStore.initialize();

		expect(mockInit).toHaveBeenCalledOnce();
	});

	it('sets error state when initialization fails', async () => {
		mockInit.mockRejectedValueOnce(new Error('Worker failed to load'));

		await dbStore.initialize();

		const state = get(dbStore);
		expect(state.isReady).toBe(false);
		expect(state.executor).toBeNull();
		expect(state.error).toBe('Worker failed to load');
		expect(state.isInitializing).toBe(false);
	});

	it('handles non-Error exceptions during initialization', async () => {
		mockInit.mockRejectedValueOnce('string error');

		await dbStore.initialize();

		const state = get(dbStore);
		expect(state.isReady).toBe(false);
		expect(state.error).toBe('Failed to initialize database');
	});

	it('close resets to initial state', async () => {
		mockInit.mockResolvedValueOnce(undefined);
		await dbStore.initialize();

		await dbStore.close();

		const state = get(dbStore);
		expect(state.isReady).toBe(false);
		expect(state.executor).toBeNull();
		expect(state.error).toBeNull();
		expect(mockClose).toHaveBeenCalledOnce();
	});

	it('close is safe to call when not initialized', async () => {
		await dbStore.close();

		const state = get(dbStore);
		expect(state.isReady).toBe(false);
		expect(mockClose).not.toHaveBeenCalled();
	});

	it('can re-initialize after close', async () => {
		mockInit.mockResolvedValue(undefined);

		await dbStore.initialize();
		await dbStore.close();
		await dbStore.initialize();

		const state = get(dbStore);
		expect(state.isReady).toBe(true);
		expect(state.executor).toBe(mockExec);
		expect(mockInit).toHaveBeenCalledTimes(2);
	});
});
