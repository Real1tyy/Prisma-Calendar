import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Emitterlike } from "../../src/hooks/use-obsidian-event";
import { useObsidianEvent } from "../../src/hooks/use-obsidian-event";

function makeEmitter(): Emitterlike & { fire: (name: string, ...args: unknown[]) => void } {
	const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
	return {
		on(event, callback) {
			if (!listeners.has(event as string)) listeners.set(event as string, []);
			listeners.get(event as string)!.push(callback);
		},
		off(event, callback) {
			const arr = listeners.get(event as string);
			if (!arr) return;
			const i = arr.indexOf(callback);
			if (i >= 0) arr.splice(i, 1);
		},
		fire(name, ...args) {
			for (const fn of listeners.get(name) ?? []) fn(...args);
		},
	};
}

describe("useObsidianEvent", () => {
	it("subscribes on mount and fires when the emitter emits", () => {
		const emitter = makeEmitter();
		const cb = vi.fn();
		renderHook(() => useObsidianEvent(emitter, "ping", cb));

		emitter.fire("ping", 1, 2);

		expect(cb).toHaveBeenCalledExactlyOnceWith(1, 2);
	});

	it("unsubscribes on unmount", () => {
		const emitter = makeEmitter();
		const cb = vi.fn();
		const { unmount } = renderHook(() => useObsidianEvent(emitter, "ping", cb));

		unmount();
		emitter.fire("ping");

		expect(cb).not.toHaveBeenCalled();
	});

	it("is a no-op when emitter is null", () => {
		expect(() => renderHook(() => useObsidianEvent(null, "ping", vi.fn()))).not.toThrow();
	});
});
