import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchemaField } from "../../src/settings/schema-field";
import { descriptorFor, EXAMPLE_DEFAULTS } from "../helpers/fixtures";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

/**
 * Regression guard for external-store → UI propagation. Inputs are fully
 * controlled, so a store mutation driven from outside React must surface in
 * the DOM on the next render. Guards against any future reintroduction of
 * local state that would break this.
 */
describe("SchemaField — external store updates flow back into mounted controls", () => {
	it("TextInput reflects a store update driven from outside React", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("title")} />);

		expect(screen.getByRole("textbox")).toHaveValue("Untitled");

		await act(async () => {
			await store.updateSettings((s) => ({ ...s, title: "Reset" }));
		});

		expect(screen.getByRole("textbox")).toHaveValue("Reset");
	});

	it("NumberInput reflects a store update driven from outside React", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("rating")} />);

		expect(screen.getByRole("spinbutton")).toHaveValue(0);

		await act(async () => {
			await store.updateSettings((s) => ({ ...s, rating: 7 }));
		});

		expect(screen.getByRole("spinbutton")).toHaveValue(7);
	});

	it("Slider reflects a store update driven from outside React", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("count")} />);

		expect(screen.getByRole("slider")).toHaveValue("0");

		await act(async () => {
			await store.updateSettings((s) => ({ ...s, count: 7 }));
		});

		expect(screen.getByRole("slider")).toHaveValue("7");
	});
});
