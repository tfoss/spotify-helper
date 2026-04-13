/**
 * Tests for the command palette logic module.
 *
 * Covers: PALETTE_COMMANDS structure, filterCommands, isPaletteToggleEvent.
 */

import { describe, it, expect } from 'vitest';
import {
	PALETTE_COMMANDS,
	filterCommands,
	isPaletteToggleEvent,
	type PaletteCommand,
} from '../../../src/lib/palette/commands';

// ---------------------------------------------------------------------------
// PALETTE_COMMANDS
// ---------------------------------------------------------------------------

describe('PALETTE_COMMANDS', () => {
	it('is a non-empty array', () => {
		expect(PALETTE_COMMANDS.length).toBeGreaterThan(0);
	});

	it('each command has id, label, description, and icon', () => {
		for (const cmd of PALETTE_COMMANDS) {
			expect(typeof cmd.id).toBe('string');
			expect(cmd.id.length).toBeGreaterThan(0);
			expect(typeof cmd.label).toBe('string');
			expect(cmd.label.length).toBeGreaterThan(0);
			expect(typeof cmd.description).toBe('string');
			expect(typeof cmd.icon).toBe('string');
		}
	});

	it('includes a navigate-to-search command', () => {
		expect(PALETTE_COMMANDS.some((c) => c.id === 'nav:search')).toBe(true);
	});

	it('includes a navigate-to-analytics command', () => {
		expect(PALETTE_COMMANDS.some((c) => c.id === 'nav:analytics')).toBe(true);
	});

	it('includes a sync command', () => {
		expect(PALETTE_COMMANDS.some((c) => c.id === 'action:sync')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// filterCommands
// ---------------------------------------------------------------------------

describe('filterCommands', () => {
	const commands: PaletteCommand[] = [
		{ id: 'nav:search', label: 'Go to Search', description: 'Search playlists', icon: '🔍' },
		{ id: 'nav:analytics', label: 'Go to Analytics', description: 'View analytics', icon: '📊' },
		{ id: 'action:sync', label: 'Sync Library', description: 'Sync from Spotify', icon: '🔄' },
	];

	it('returns all commands when query is empty', () => {
		expect(filterCommands(commands, '')).toHaveLength(commands.length);
	});

	it('returns all commands when query is whitespace-only', () => {
		expect(filterCommands(commands, '   ')).toHaveLength(commands.length);
	});

	it('typing "search" returns the Search command', () => {
		const result = filterCommands(commands, 'search');
		expect(result.some((c) => c.id === 'nav:search')).toBe(true);
	});

	it('typing "analytics" returns only the Analytics command', () => {
		const result = filterCommands(commands, 'analytics');
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('nav:analytics');
	});

	it('typing "sync" returns the Sync Library command', () => {
		const result = filterCommands(commands, 'sync');
		expect(result.some((c) => c.id === 'action:sync')).toBe(true);
	});

	it('filtering is case-insensitive', () => {
		const lower = filterCommands(commands, 'search');
		const upper = filterCommands(commands, 'SEARCH');
		expect(lower).toHaveLength(upper.length);
		expect(lower.map((c) => c.id)).toEqual(upper.map((c) => c.id));
	});

	it('returns empty array when no commands match', () => {
		const result = filterCommands(commands, 'xyzqwerty');
		expect(result).toHaveLength(0);
	});

	it('matches against description as well as label', () => {
		// 'spotify' only appears in descriptions
		const result = filterCommands(commands, 'spotify');
		expect(result.length).toBeGreaterThan(0);
	});

	it('partial query matches correctly', () => {
		// 'go to' matches both nav commands
		const result = filterCommands(commands, 'go to');
		expect(result.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// isPaletteToggleEvent
// ---------------------------------------------------------------------------

describe('isPaletteToggleEvent', () => {
	it('CMD+K on macOS triggers palette', () => {
		expect(isPaletteToggleEvent({ metaKey: true, ctrlKey: false, key: 'k' })).toBe(true);
	});

	it('Ctrl+K on Windows/Linux triggers palette', () => {
		expect(isPaletteToggleEvent({ metaKey: false, ctrlKey: true, key: 'k' })).toBe(true);
	});

	it('plain K does not trigger palette', () => {
		expect(isPaletteToggleEvent({ metaKey: false, ctrlKey: false, key: 'k' })).toBe(false);
	});

	it('CMD+other key does not trigger palette', () => {
		expect(isPaletteToggleEvent({ metaKey: true, ctrlKey: false, key: 'p' })).toBe(false);
	});

	it('Escape does not trigger palette', () => {
		expect(isPaletteToggleEvent({ metaKey: false, ctrlKey: false, key: 'Escape' })).toBe(false);
	});
});
