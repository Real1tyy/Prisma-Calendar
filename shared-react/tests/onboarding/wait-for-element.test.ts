import { afterEach, describe, expect, it } from "vitest";

import { waitForElement } from "../../src/onboarding/wait-for-element";

afterEach(() => {
	document.body.replaceChildren();
});

function appendLater(id: string, delayMs = 5): void {
	window.setTimeout(() => {
		const el = document.createElement("div");
		el.id = id;
		document.body.appendChild(el);
	}, delayMs);
}

describe("waitForElement", () => {
	it("resolves immediately when the element already exists", async () => {
		const existing = document.createElement("div");
		existing.id = "present";
		document.body.appendChild(existing);

		await expect(waitForElement("#present")).resolves.toBe(existing);
	});

	it("resolves once a matching element is added to the DOM", async () => {
		const promise = waitForElement("#late", { timeout: 1000 });
		appendLater("late");

		const resolved = await promise;
		expect(resolved).toBe(document.getElementById("late"));
	});

	it("resolves null when the element never appears within the timeout", async () => {
		await expect(waitForElement("#never", { timeout: 30 })).resolves.toBeNull();
	});

	it("scopes the search to a provided root", async () => {
		const root = document.createElement("section");
		document.body.appendChild(root);
		const outside = document.createElement("span");
		outside.className = "needle";
		document.body.appendChild(outside);

		await expect(waitForElement(".needle", { root, timeout: 30 })).resolves.toBeNull();

		const inside = document.createElement("span");
		inside.className = "needle";
		root.appendChild(inside);
		await expect(waitForElement(".needle", { root })).resolves.toBe(inside);
	});
});
