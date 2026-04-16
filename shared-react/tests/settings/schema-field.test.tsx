import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchemaField } from "../../src/settings/schema-field";
import { descriptorFor, EXAMPLE_DEFAULTS } from "../helpers/fixtures";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

describe("SchemaField", () => {
	it("renders a Toggle for a boolean descriptor", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("enabled")} />);

		const toggle = screen.getByRole("switch");
		expect(toggle).toHaveAttribute("aria-checked", "false");
	});

	it("renders a Dropdown for an enum descriptor with enum values as options", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("mode")} />);

		const select = screen.getByRole("combobox") as HTMLSelectElement;
		expect(select).toHaveValue("auto");
		expect(select.options).toHaveLength(3);
	});

	it("renders a NumberInput for an unbounded number descriptor", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("rating")} />);

		expect(screen.getByRole("spinbutton")).toHaveValue(0);
	});

	it("renders a Slider for a bounded number descriptor", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("count")} />);

		expect(screen.getByRole("slider")).toHaveValue("0");
	});

	it("renders a TextInput for a string descriptor", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(<SchemaField store={store} descriptor={descriptorFor("title")} />);

		expect(screen.getByRole("textbox")).toHaveValue("Untitled");
	});

	it("renders a CSV TextInput for an array descriptor and parses comma-separated input", async () => {
		const store = makeStore({ ...EXAMPLE_DEFAULTS, tags: ["alpha", "beta"] });
		const { user } = renderReact(<SchemaField store={store} descriptor={descriptorFor("tags")} />);

		const input = screen.getByRole("textbox") as HTMLInputElement;
		expect(input).toHaveValue("alpha, beta");

		await user.clear(input);
		await user.type(input, "one, two ,three");
		await user.tab();

		expect(store.settings$.getValue().tags).toEqual(["one", "two", "three"]);
	});

	it("coerces numeric arrays and drops NaN entries", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { user } = renderReact(<SchemaField store={store} descriptor={descriptorFor("scores")} />);

		await user.click(screen.getByRole("textbox"));
		await user.keyboard("1, abc, 2");
		await user.tab();

		expect(store.settings$.getValue().scores).toEqual([1, 2]);
	});

	it("respects `override.hidden`", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { container } = renderReact(
			<SchemaField store={store} descriptor={descriptorFor("title")} override={{ hidden: true }} />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("uses `override.render` as an escape hatch while keeping the SettingItem wrapper", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(
			<SchemaField
				store={store}
				descriptor={descriptorFor("title")}
				override={{
					render: ({ value }) => <div data-testid="custom">custom:{String(value)}</div>,
				}}
			/>
		);

		expect(screen.getByTestId("custom")).toHaveTextContent("custom:Untitled");
	});

	it("applies `override.label` and `override.description` to the SettingItem", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(
			<SchemaField
				store={store}
				descriptor={descriptorFor("title")}
				override={{ label: "Custom label", description: "Custom desc" }}
			/>
		);

		expect(screen.getByText("Custom label")).toBeInTheDocument();
		expect(screen.getByText("Custom desc")).toBeInTheDocument();
	});

	it("commits an empty optional string as `undefined`", async () => {
		const store = makeStore({ ...EXAMPLE_DEFAULTS, bio: "initial" });
		const { user } = renderReact(<SchemaField store={store} descriptor={descriptorFor("bio")} />);

		const input = screen.getByRole("textbox");
		await user.clear(input);
		await user.tab();

		expect(store.settings$.getValue().bio).toBeUndefined();
	});

	it("commits via a custom `override.options` mapping for enum fields", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { user } = renderReact(
			<SchemaField
				store={store}
				descriptor={descriptorFor("mode")}
				override={{ options: { light: "☀️", dark: "🌙", auto: "✨" } }}
			/>
		);

		expect(screen.getByRole("option", { name: "☀️" })).toHaveValue("light");

		await user.selectOptions(screen.getByRole("combobox"), "dark");
		expect(store.settings$.getValue().mode).toBe("dark");
	});
});
