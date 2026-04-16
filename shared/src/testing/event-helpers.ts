/**
 * Test helpers for working with event-driven Obsidian patterns.
 *
 * These helpers make it easy to assert that events were fired, wait for
 * specific events, and capture event payloads in tests.
 */

import { createEventEmitter, type EventCallback, type EventEmitter, type EventRef } from "./event-emitter";

interface TriggeredEvent {
	name: string;
	args: unknown[];
}

interface TestEventEmitter extends EventEmitter {
	/** Returns all events that have been triggered, in order. */
	getTriggeredEvents: () => TriggeredEvent[];
	/** Clears the triggered events log. */
	clearLog: () => void;
}

type Subscribable = Pick<EventEmitter, "on" | "offref">;

/**
 * Creates a test event emitter with event logging.
 *
 * Unlike the plain `EventEmitter` used inside FakeVault, this one records every
 * triggered event for assertions.
 *
 * @example
 * ```ts
 * const emitter = createTestEventEmitter();
 * emitter.on('changed', spy);
 * emitter.trigger('changed', file, content);
 * expect(emitter.getTriggeredEvents()).toHaveLength(1);
 * expect(spy).toHaveBeenCalledWith(file, content);
 * ```
 */
export function createTestEventEmitter(): TestEventEmitter {
	const inner = createEventEmitter();
	const log: TriggeredEvent[] = [];

	return {
		...inner,
		trigger(name, ...args) {
			log.push({ name, args });
			inner.trigger(name, ...args);
		},
		getTriggeredEvents() {
			return [...log];
		},
		clearLog() {
			log.length = 0;
		},
	};
}

/**
 * Returns a promise that resolves the next time the given event fires on the emitter.
 *
 * Useful for waiting on async event chains in tests.
 *
 * @example
 * ```ts
 * const changed = waitForEvent(metadataCache, 'changed');
 * await vault.modify(file, newContent);
 * const [changedFile, content, cache] = await changed;
 * ```
 */
export function waitForEvent(emitter: Subscribable, eventName: string): Promise<unknown[]> {
	return new Promise((resolve) => {
		const ref = emitter.on(eventName, (...args) => {
			emitter.offref(ref);
			resolve(args);
		});
	});
}

/**
 * Captures all events of a given name fired during the execution of an async function.
 *
 * @example
 * ```ts
 * const events = await captureEvents(vault, 'create', async () => {
 *   await vault.create('a.md', '');
 *   await vault.create('b.md', '');
 * });
 * expect(events).toHaveLength(2);
 * ```
 */
export async function captureEvents(
	emitter: Subscribable,
	eventName: string,
	fn: () => Promise<void>
): Promise<unknown[][]> {
	const captured: unknown[][] = [];
	const ref = emitter.on(eventName, (...args) => {
		captured.push(args);
	});

	try {
		await fn();
	} finally {
		emitter.offref(ref);
	}

	return captured;
}

export type { EventCallback, EventRef, TestEventEmitter };
