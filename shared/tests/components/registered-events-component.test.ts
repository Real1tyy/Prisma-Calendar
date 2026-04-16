import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisteredEventsComponent } from "../../src/components/primitives/registered-events-component";

class TestComponent extends RegisteredEventsComponent {
	registerTestEvent<T extends PropertyKey>(
		emitter: {
			on(event: T, callback: (...args: unknown[]) => void): void;
			off(event: T, callback: (...args: unknown[]) => void): void;
		},
		event: T,
		callback: (...args: unknown[]) => void
	): void {
		this.registerEvent(emitter, event, callback);
	}

	registerTestDomEvent<K extends keyof WindowEventMap>(
		target: Window | Document | HTMLElement,
		event: K,
		callback: (evt: WindowEventMap[K]) => void
	): void {
		this.registerDomEvent(target, event, callback);
	}

	destroy(): void {
		this.cleanupEvents();
	}

	getCleanupCount(): number {
		return this.eventCleanupFunctions.length;
	}
}

describe("RegisteredEventsComponent", () => {
	let component: TestComponent;

	beforeEach(() => {
		component = new TestComponent();
	});

	afterEach(() => {
		component.destroy();
	});

	describe("registerEvent", () => {
		it("should call emitter.on with the event and callback", () => {
			const emitter = { on: vi.fn(), off: vi.fn() };
			const callback = vi.fn();

			component.registerTestEvent(emitter, "change", callback);

			expect(emitter.on).toHaveBeenCalledWith("change", callback);
		});

		it("should track a cleanup function", () => {
			const emitter = { on: vi.fn(), off: vi.fn() };

			component.registerTestEvent(emitter, "update", vi.fn());

			expect(component.getCleanupCount()).toBe(1);
		});

		it("should register multiple events", () => {
			const emitter = { on: vi.fn(), off: vi.fn() };

			component.registerTestEvent(emitter, "event-a", vi.fn());
			component.registerTestEvent(emitter, "event-b", vi.fn());
			component.registerTestEvent(emitter, "event-c", vi.fn());

			expect(component.getCleanupCount()).toBe(3);
		});
	});

	describe("registerDomEvent", () => {
		it("should add an event listener to the target", () => {
			const el = document.createElement("div");
			const spy = vi.spyOn(el, "addEventListener");
			const callback = vi.fn();

			component.registerTestDomEvent(el, "click", callback);

			expect(spy).toHaveBeenCalledWith("click", expect.any(Function));
		});

		it("should track a cleanup function", () => {
			const el = document.createElement("div");

			component.registerTestDomEvent(el, "click", vi.fn());

			expect(component.getCleanupCount()).toBe(1);
		});
	});

	describe("cleanupEvents", () => {
		it("should call emitter.off for registered events", () => {
			const emitter = { on: vi.fn(), off: vi.fn() };
			const callback = vi.fn();

			component.registerTestEvent(emitter, "change", callback);
			component.destroy();

			expect(emitter.off).toHaveBeenCalledWith("change", callback);
		});

		it("should remove DOM event listeners", () => {
			const el = document.createElement("div");
			const spy = vi.spyOn(el, "removeEventListener");

			component.registerTestDomEvent(el, "click", vi.fn());
			component.destroy();

			expect(spy).toHaveBeenCalledWith("click", expect.any(Function));
		});

		it("should clean up all events at once", () => {
			const emitter1 = { on: vi.fn(), off: vi.fn() };
			const emitter2 = { on: vi.fn(), off: vi.fn() };
			const el = document.createElement("div");

			component.registerTestEvent(emitter1, "a", vi.fn());
			component.registerTestEvent(emitter2, "b", vi.fn());
			component.registerTestDomEvent(el, "click", vi.fn());

			expect(component.getCleanupCount()).toBe(3);

			component.destroy();

			expect(emitter1.off).toHaveBeenCalled();
			expect(emitter2.off).toHaveBeenCalled();
			expect(component.getCleanupCount()).toBe(0);
		});

		it("should be safe to call multiple times", () => {
			const emitter = { on: vi.fn(), off: vi.fn() };

			component.registerTestEvent(emitter, "x", vi.fn());
			component.destroy();
			component.destroy();

			expect(emitter.off).toHaveBeenCalledTimes(1);
		});
	});
});
