/**
 * Race-condition tests for `VirtualEventStore`.
 *
 * The rebind path in the settings subscription is fire-and-forget — it
 * assigns `this.binding` inside a `.then` callback. Before the `bindEpoch`
 * guard, three bugs existed:
 *
 * 1. **Out-of-order binding assignment.** Two rapid settings changes (A→B,
 *    then B→C) kick off two rebinds. If the second resolves BEFORE the
 *    first, `this.binding` ends up pointing at the earlier (stale) binding.
 *
 * 2. **Binding leak on concurrent rebind.** Both rebinds see the same old
 *    binding. Both `bind()` calls register a fresh vault "modify" listener;
 *    only one wins `this.binding` — the other is orphaned but still live.
 *
 * 3. **Destroy-during-rebind.** `destroy()` clears `this.binding`, but an
 *    in-flight rebind's `.then` resurrects it after destroy. The store is
 *    "dead" yet still holds a live vault listener.
 *
 * Fix: bump `bindEpoch` when a new rebind starts (or on destroy); the .then
 * callback aborts and unsubscribes its freshly-produced binding if its
 * captured epoch is stale. These tests pin that behavior.
 */
import { createDeferred } from "@real1ty-obsidian-plugins/testing";
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualEventStore } from "../../src/core/virtual-event-store";
import { createMockSingleCalendarSettingsStore } from "../setup";

type Binding = { unsubscribe: () => void; id: string; filePath: string };

interface RepoStub {
	bind: ReturnType<typeof vi.fn>;
	rebind: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
	toArray: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

function installRepoStub(store: VirtualEventStore): {
	rebindCalls: Array<{
		oldBinding: Binding;
		filePath: string;
		deferred: ReturnType<typeof createDeferred<Binding>>;
	}>;
} {
	const rebindCalls: Array<{
		oldBinding: Binding;
		filePath: string;
		deferred: ReturnType<typeof createDeferred<Binding>>;
	}> = [];

	const stub: RepoStub = {
		bind: vi.fn(async () => ({ id: "bind-stub", filePath: "stub", unsubscribe: vi.fn() }) as Binding),
		rebind: vi.fn(async (oldBinding: Binding, _app, filePath: string) => {
			oldBinding.unsubscribe();
			const deferred = createDeferred<Binding>();
			rebindCalls.push({ oldBinding, filePath, deferred });
			return deferred.promise;
		}),
		get: vi.fn().mockReturnValue(undefined),
		toArray: vi.fn().mockReturnValue([]),
		create: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	};

	(store as unknown as { repo: RepoStub }).repo = stub;

	return { rebindCalls };
}

function resolveRebindCall(
	rebindCalls: Array<{
		oldBinding: Binding;
		filePath: string;
		deferred: ReturnType<typeof createDeferred<Binding>>;
	}>,
	index: number,
	filePath: string
): Binding {
	const call = rebindCalls[index];
	if (!call) throw new Error(`rebind call ${index} not recorded`);
	const binding: Binding = { id: `rebind-binding-${index}`, filePath, unsubscribe: vi.fn() };
	call.deferred.resolve(binding);
	return binding;
}

function getBinding(store: VirtualEventStore): Binding | null {
	return (store as unknown as { binding: Binding | null }).binding;
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("VirtualEventStore — rebind race conditions", () => {
	let settingsStore: BehaviorSubject<any>;
	let store: VirtualEventStore;

	beforeEach(() => {
		settingsStore = createMockSingleCalendarSettingsStore({
			directory: "Events",
			virtualEventsFileName: "virtual",
		});
		store = new VirtualEventStore({ vault: {}, workspace: {} } as any, settingsStore);
	});

	afterEach(() => {
		try {
			store.destroy();
		} catch {
			// destroy may have already run mid-test
		}
	});

	it("out-of-order rebind resolution: latest settings win regardless of resolve order", async () => {
		const { rebindCalls } = installRepoStub(store);

		// Seed an initial binding from initialize().
		const initialBinding: Binding = { id: "initial", filePath: "Events/virtual.md", unsubscribe: vi.fn() };
		(store as unknown as { binding: Binding }).binding = initialBinding;

		// Rapid A → B → C.
		settingsStore.next({ ...settingsStore.value, directory: "EventsB" });
		settingsStore.next({ ...settingsStore.value, directory: "EventsC" });

		expect(rebindCalls).toHaveLength(2);
		expect(rebindCalls[0].filePath).toBe("EventsB/virtual.md");
		expect(rebindCalls[1].filePath).toBe("EventsC/virtual.md");

		// Second (→C) resolves first, then first (→B) resolves last.
		const bindingC = resolveRebindCall(rebindCalls, 1, "EventsC/virtual.md");
		await flushMicrotasks();
		const bindingB = resolveRebindCall(rebindCalls, 0, "EventsB/virtual.md");
		await flushMicrotasks();

		// Epoch guard discards the stale B rebind and keeps C. The stale
		// binding's listener is proactively unsubscribed to prevent a leak.
		expect(store.getFilePath()).toBe("EventsC/virtual.md");
		expect(getBinding(store)?.filePath).toBe("EventsC/virtual.md");
		expect(getBinding(store)).toBe(bindingC);
		expect(bindingB.unsubscribe).toHaveBeenCalled();
	});

	it("concurrent rebinds: the stale binding is unsubscribed, no leak", async () => {
		const { rebindCalls } = installRepoStub(store);

		const initialBinding: Binding = { id: "initial", filePath: "Events/virtual.md", unsubscribe: vi.fn() };
		(store as unknown as { binding: Binding }).binding = initialBinding;

		settingsStore.next({ ...settingsStore.value, directory: "EventsB" });
		settingsStore.next({ ...settingsStore.value, directory: "EventsC" });

		// Both rebinds received the SAME oldBinding reference (initial) — the
		// second rebind could not see the first's .then result yet.
		expect(rebindCalls[0].oldBinding).toBe(initialBinding);
		expect(rebindCalls[1].oldBinding).toBe(initialBinding);
		// So initial.unsubscribe is invoked twice — the second call cannot
		// unsubscribe the binding that resolved from rebindCalls[0] because
		// that binding didn't exist yet when rebindCalls[1] started.
		expect(initialBinding.unsubscribe).toHaveBeenCalledTimes(2);

		const bindingB = resolveRebindCall(rebindCalls, 0, "EventsB/virtual.md");
		const bindingC = resolveRebindCall(rebindCalls, 1, "EventsC/virtual.md");
		await flushMicrotasks();

		const current = getBinding(store);
		expect(current).toBe(bindingC);
		// The epoch guard unsubscribes the stale B binding rather than
		// leaving it as a silent vault listener. No leak.
		expect(bindingB.unsubscribe).toHaveBeenCalled();
	});

	it("destroy() during in-flight rebind: the late binding is unsubscribed, store stays dead", async () => {
		const { rebindCalls } = installRepoStub(store);

		const initialBinding: Binding = { id: "initial", filePath: "Events/virtual.md", unsubscribe: vi.fn() };
		(store as unknown as { binding: Binding }).binding = initialBinding;

		settingsStore.next({ ...settingsStore.value, directory: "EventsB" });
		expect(rebindCalls).toHaveLength(1);

		// User removes calendar / reloads plugin mid-rebind.
		store.destroy();
		expect(getBinding(store)).toBeNull();

		// In-flight rebind resolves AFTER destroy().
		const lateBinding = resolveRebindCall(rebindCalls, 0, "EventsB/virtual.md");
		await flushMicrotasks();

		// Destroyed flag short-circuits the late .then — binding stays null
		// and the orphan is unsubscribed immediately instead of lingering
		// as a zombie vault listener.
		expect(getBinding(store)).toBeNull();
		expect(lateBinding.unsubscribe).toHaveBeenCalled();
	});

	it("sanity: single rebind resolves cleanly and leaves binding pointing at the new file", async () => {
		const { rebindCalls } = installRepoStub(store);

		const initialBinding: Binding = { id: "initial", filePath: "Events/virtual.md", unsubscribe: vi.fn() };
		(store as unknown as { binding: Binding }).binding = initialBinding;

		settingsStore.next({ ...settingsStore.value, directory: "EventsB" });

		expect(rebindCalls).toHaveLength(1);
		expect(initialBinding.unsubscribe).toHaveBeenCalledTimes(1);

		const newBinding = resolveRebindCall(rebindCalls, 0, "EventsB/virtual.md");
		await flushMicrotasks();

		expect(getBinding(store)).toBe(newBinding);
		expect(store.getFilePath()).toBe("EventsB/virtual.md");
	});

	it("sanity: settings change that does NOT touch directory/fileName does not trigger rebind", async () => {
		const { rebindCalls } = installRepoStub(store);

		const initialBinding: Binding = { id: "initial", filePath: "Events/virtual.md", unsubscribe: vi.fn() };
		(store as unknown as { binding: Binding }).binding = initialBinding;

		settingsStore.next({ ...settingsStore.value, statusProperty: "Done" });

		expect(rebindCalls).toHaveLength(0);
		expect(initialBinding.unsubscribe).not.toHaveBeenCalled();
	});
});
