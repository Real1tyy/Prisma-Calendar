import { afterEach, describe, expect, it } from "vitest";

import { FirstIndexNoticeStore } from "../../src/core/first-index-notice-store";

describe("FirstIndexNoticeStore", () => {
	afterEach(() => {
		window.localStorage.clear();
	});

	it("fires once for a calendar, then never again", () => {
		const store = new FirstIndexNoticeStore();

		expect(store.claim("work")).toBe(true);
		expect(store.claim("work")).toBe(false);
		expect(store.claim("work")).toBe(false);
	});

	it("tracks each calendar independently", () => {
		const store = new FirstIndexNoticeStore();

		expect(store.claim("work")).toBe(true);
		expect(store.claim("personal")).toBe(true);
		expect(store.claim("work")).toBe(false);
		expect(store.claim("personal")).toBe(false);
	});

	it("persists the claim across store instances on the same device", () => {
		expect(new FirstIndexNoticeStore().claim("work")).toBe(true);
		expect(new FirstIndexNoticeStore().claim("work")).toBe(false);
	});
});
