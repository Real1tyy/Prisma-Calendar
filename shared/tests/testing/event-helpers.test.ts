import { describe, expect, it, vi } from "vitest";

import { captureEvents, createTestEventEmitter, waitForEvent } from "../../src/testing/event-helpers";

describe("createTestEventEmitter", () => {
	it("should register and trigger listeners", () => {
		const emitter = createTestEventEmitter();
		const spy = vi.fn();

		emitter.on("test", spy);
		emitter.trigger("test", "arg1", "arg2");

		expect(spy).toHaveBeenCalledWith("arg1", "arg2");
	});

	it("should support multiple listeners on the same event", () => {
		const emitter = createTestEventEmitter();
		const spy1 = vi.fn();
		const spy2 = vi.fn();

		emitter.on("test", spy1);
		emitter.on("test", spy2);
		emitter.trigger("test");

		expect(spy1).toHaveBeenCalledOnce();
		expect(spy2).toHaveBeenCalledOnce();
	});

	it("should remove listener via off", () => {
		const emitter = createTestEventEmitter();
		const spy = vi.fn();

		emitter.on("test", spy);
		emitter.off("test", spy);
		emitter.trigger("test");

		expect(spy).not.toHaveBeenCalled();
	});

	it("should remove listener via offref", () => {
		const emitter = createTestEventEmitter();
		const spy = vi.fn();

		const ref = emitter.on("test", spy);
		emitter.offref(ref);
		emitter.trigger("test");

		expect(spy).not.toHaveBeenCalled();
	});

	it("should log triggered events", () => {
		const emitter = createTestEventEmitter();

		emitter.trigger("create", { path: "a.md" });
		emitter.trigger("modify", { path: "b.md" });

		const events = emitter.getTriggeredEvents();
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({ name: "create", args: [{ path: "a.md" }] });
		expect(events[1]).toEqual({ name: "modify", args: [{ path: "b.md" }] });
	});

	it("should clear event log", () => {
		const emitter = createTestEventEmitter();

		emitter.trigger("test");
		expect(emitter.getTriggeredEvents()).toHaveLength(1);

		emitter.clearLog();
		expect(emitter.getTriggeredEvents()).toHaveLength(0);
	});

	it("should not throw when triggering event with no listeners", () => {
		const emitter = createTestEventEmitter();
		expect(() => emitter.trigger("unknown")).not.toThrow();
	});
});

describe("waitForEvent", () => {
	it("should resolve when the event fires", async () => {
		const emitter = createTestEventEmitter();

		const promise = waitForEvent(emitter, "done");
		emitter.trigger("done", "result", 42);

		const args = await promise;
		expect(args).toEqual(["result", 42]);
	});

	it("should only resolve once (auto-unsubscribes)", async () => {
		const emitter = createTestEventEmitter();

		const promise = waitForEvent(emitter, "test");
		emitter.trigger("test", "first");

		await promise;

		emitter.trigger("test", "second");
		const events = emitter.getTriggeredEvents().filter((e) => e.name === "test");
		expect(events).toHaveLength(2);
	});
});

describe("captureEvents", () => {
	it("should capture all events fired during fn execution", async () => {
		const emitter = createTestEventEmitter();

		const events = await captureEvents(emitter, "create", async () => {
			emitter.trigger("create", "file-a");
			emitter.trigger("create", "file-b");
			emitter.trigger("create", "file-c");
		});

		expect(events).toHaveLength(3);
		expect(events[0]).toEqual(["file-a"]);
		expect(events[1]).toEqual(["file-b"]);
		expect(events[2]).toEqual(["file-c"]);
	});

	it("should not capture events from other event names", async () => {
		const emitter = createTestEventEmitter();

		const events = await captureEvents(emitter, "create", async () => {
			emitter.trigger("create", "yes");
			emitter.trigger("modify", "no");
			emitter.trigger("delete", "no");
		});

		expect(events).toHaveLength(1);
	});

	it("should unsubscribe after fn completes", async () => {
		const emitter = createTestEventEmitter();

		await captureEvents(emitter, "test", async () => {
			emitter.trigger("test", "during");
		});

		const laterEvents = await captureEvents(emitter, "test", async () => {
			// no triggers
		});

		expect(laterEvents).toHaveLength(0);
	});

	it("should unsubscribe even if fn throws", async () => {
		const emitter = createTestEventEmitter();

		await expect(
			captureEvents(emitter, "test", async () => {
				emitter.trigger("test", "before-error");
				throw new Error("boom");
			})
		).rejects.toThrow("boom");
	});
});
