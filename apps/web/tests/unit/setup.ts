/**
 * Vitest setup: replace jsdom's partial localStorage/sessionStorage
 * with a fully compliant in-memory Storage implementation.
 */

class InMemoryStorage implements Storage {
	private store = new Map<string, string>();

	get length(): number {
		return this.store.size;
	}

	key(index: number): string | null {
		const keys = Array.from(this.store.keys());
		return index < keys.length ? keys[index] : null;
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

Object.defineProperty(globalThis, 'localStorage', {
	value: new InMemoryStorage(),
	writable: true
});

Object.defineProperty(globalThis, 'sessionStorage', {
	value: new InMemoryStorage(),
	writable: true
});
