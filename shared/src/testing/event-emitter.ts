/**
 * Internal event emitter primitive used by FakeVault and createTestEventEmitter.
 *
 * Mirrors Obsidian's on/off/offref/trigger surface. Not exported from the package
 * barrel — consumers use FakeVault or createTestEventEmitter, which wrap this.
 */

export type EventCallback = (...args: unknown[]) => void;

export interface EventRef {
	name: string;
	callback: EventCallback;
}

export interface EventEmitter {
	on: (name: string, callback: EventCallback) => EventRef;
	off: (name: string, callback: EventCallback) => void;
	offref: (ref: EventRef) => void;
	trigger: (name: string, ...args: unknown[]) => void;
}

export function createEventEmitter(): EventEmitter {
	const listeners = new Map<string, Set<EventCallback>>();

	return {
		on(name, callback) {
			let set = listeners.get(name);
			if (!set) {
				set = new Set();
				listeners.set(name, set);
			}
			set.add(callback);
			return { name, callback };
		},
		off(name, callback) {
			listeners.get(name)?.delete(callback);
		},
		offref(ref) {
			listeners.get(ref.name)?.delete(ref.callback);
		},
		trigger(name, ...args) {
			const cbs = listeners.get(name);
			if (!cbs) return;
			for (const cb of cbs) cb(...args);
		},
	};
}
