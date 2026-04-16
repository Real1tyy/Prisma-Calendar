import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SchemaSection } from "../../src/settings/schema-section";
import { EXAMPLE_DEFAULTS, ExampleSchema } from "../helpers/fixtures";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

describe("SchemaSection", () => {
	it("renders one SettingItem per descriptor and honors the heading", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { container } = renderReact(<SchemaSection store={store} shape={ExampleSchema.shape} heading="Example" />);

		expect(screen.getByText("Example")).toBeInTheDocument();
		const items = container.querySelectorAll(".setting-item:not(.setting-item-heading)");
		expect(items).toHaveLength(Object.keys(ExampleSchema.shape).length);
	});

	it("omits the heading element when `heading` is not provided", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { container } = renderReact(<SchemaSection store={store} shape={ExampleSchema.shape} />);

		expect(container.querySelector(".setting-item-heading")).toBeNull();
	});

	it("respects the explicit `fields` order and silently ignores unknown keys", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { container } = renderReact(
			<SchemaSection store={store} shape={ExampleSchema.shape} fields={["enabled", "title", "nonexistent"]} />
		);

		const names = Array.from(container.querySelectorAll(".setting-item-name")).map((el) => el.textContent);
		expect(names).toEqual(["Enabled", "Title"]);
	});

	it("applies `labelTransform` only when `override.label` is absent", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(
			<SchemaSection
				store={store}
				shape={ExampleSchema.shape}
				fields={["title", "enabled"]}
				overrides={{ enabled: { label: "Locked Label" } }}
				labelTransform={(d) => `>> ${d.label}`}
			/>
		);

		expect(screen.getByText(">> Title")).toBeInTheDocument();
		expect(screen.getByText("Locked Label")).toBeInTheDocument();
		expect(screen.queryByText(">> Enabled")).toBeNull();
	});

	it("skips fields marked `hidden` via overrides", () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		renderReact(
			<SchemaSection
				store={store}
				shape={ExampleSchema.shape}
				fields={["title", "enabled"]}
				overrides={{ enabled: { hidden: true } }}
			/>
		);

		expect(screen.getByText("Title")).toBeInTheDocument();
		expect(screen.queryByText("Enabled")).toBeNull();
	});

	it("binds fields under `pathPrefix` to nested store locations", async () => {
		const NestedSchema = z.object({ section: ExampleSchema });
		const store = makeStore({ section: EXAMPLE_DEFAULTS });

		const { user } = renderReact(
			<SchemaSection store={store} shape={NestedSchema.shape.section.shape} pathPrefix="section" fields={["title"]} />
		);

		const input = screen.getByRole("textbox");
		await user.clear(input);
		await user.type(input, "Nested");
		await user.tab();

		expect(store.settings$.getValue().section.title).toBe("Nested");
	});

	it("propagates store updates across instances bound to the same path", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);
		const { user } = renderReact(
			<div>
				<div data-testid="a">
					<SchemaSection store={store} shape={ExampleSchema.shape} fields={["title"]} />
				</div>
				<div data-testid="b">
					<SchemaSection store={store} shape={ExampleSchema.shape} fields={["title"]} />
				</div>
			</div>
		);

		const aInput = within(screen.getByTestId("a")).getByRole("textbox");
		await user.clear(aInput);
		await user.type(aInput, "Shared");
		await user.tab();

		const bInput = within(screen.getByTestId("b")).getByRole("textbox") as HTMLInputElement;
		expect(bInput).toHaveValue("Shared");
	});
});
