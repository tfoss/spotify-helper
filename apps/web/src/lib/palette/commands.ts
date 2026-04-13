/**
 * Command palette command definitions and filtering logic.
 *
 * Pure module — no DOM or Svelte dependencies. Keeps the command list
 * testable independently of the Svelte component.
 */

export interface PaletteCommand {
	/** Unique identifier for this command. */
	id: string;
	/** Short label shown in the palette list. */
	label: string;
	/** Longer description shown alongside the label. */
	description: string;
	/** Emoji or icon identifier for visual scanning. */
	icon: string;
}

/**
 * The built-in command definitions for the palette.
 *
 * Actions are intentionally omitted here so this list can be imported
 * in test environments without pulling in routing/store dependencies.
 * The Svelte component maps each id to its corresponding action at runtime.
 */
export const PALETTE_COMMANDS: PaletteCommand[] = [
	{
		id: 'nav:search',
		label: 'Go to Search',
		description: 'Search your playlists',
		icon: '🔍',
	},
	{
		id: 'nav:analytics',
		label: 'Go to Analytics',
		description: 'View listening analytics',
		icon: '📊',
	},
	{
		id: 'action:sync',
		label: 'Sync Library',
		description: 'Sync playlists from Spotify',
		icon: '🔄',
	},
];

/**
 * Filter commands by a query string (case-insensitive substring match).
 *
 * Returns all commands when the query is empty or whitespace-only.
 *
 * @param commands - The full command list to filter.
 * @param query    - The current text input from the palette search box.
 * @returns Filtered subset of commands.
 */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return commands;
	return commands.filter(
		(cmd) =>
			cmd.label.toLowerCase().includes(trimmed) ||
			cmd.description.toLowerCase().includes(trimmed),
	);
}

/**
 * Check whether a keyboard event should open or toggle the command palette.
 *
 * Matches CMD+K (macOS) and Ctrl+K (Windows/Linux).
 *
 * @param e - The keyboard event.
 * @returns True if this event should trigger the palette toggle.
 */
export function isPaletteToggleEvent(e: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'key'>): boolean {
	return (e.metaKey || e.ctrlKey) && e.key === 'k';
}
