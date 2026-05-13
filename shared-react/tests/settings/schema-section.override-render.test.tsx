import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SchemaFieldOverride } from "../../src/settings/override";
import { SchemaSection } from "../../src/settings/schema-section";
import { EXAMPLE_DEFAULTS, ExampleSchema } from "../helpers/fixtures";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

/**
 * `SchemaFieldOverride.render` is the escape hatch for fields whose UI can't
 * be expressed through the built-in widget set. The signature passes
 * `{ value, onChange, descriptor }` — explicitly decoupled from
 * `SchemaFieldBinding`'s tuple/dual-shape return so we can reshape the binding
 * without silently breaking custom controls. This spec locks the contract:
 *
 *   - the override is mounted in place of the default widget
 *   - `value` reflects the current store state for the bound path
 *   - `onChange(next)` mutates the store via the same `useSchemaField` path
 *   - `descriptor` carries the introspected field metadata
 */
describe("SchemaSection — override.render escape hatch", () => {
	it("mounts the custom control and round-trips state through the store", async () => {
		const store = makeStore(EXAMPLE_DEFAULTS);

		const titleOverride: SchemaFieldOverride = {
			render: ({ value, onChange, descriptor }) => (
				<button
					type="button"
					data-testid="custom-title-control"
					data-descriptor-key={descriptor.key}
					data-current-value={String(value)}
					onClick={() => onChange(`${String(value)}!`)}
				>
					{`current=${String(value)}`}
				</button>
			),
		};

		const { user } = renderReact(
			<SchemaSection
				store={store}
				shape={ExampleSchema.shape}
				fields={["title"]}
				overrides={{ title: titleOverride }}
			/>
		);

		const control = screen.getByTestId("custom-title-control");
		expect(control).toHaveTextContent("current=Untitled");
		expect(control).toHaveAttribute("data-descriptor-key", "title");
		expect(control).toHaveAttribute("data-current-value", "Untitled");

		// Built-in TextWidget would render an <input role="textbox"> here —
		// confirming the override replaced it instead of layering on top.
		expect(screen.queryByRole("textbox")).toBeNull();

		await user.click(control);
		await user.click(control);

		expect(store.settings$.getValue().title).toBe("Untitled!!");
		expect(screen.getByTestId("custom-title-control")).toHaveTextContent("current=Untitled!!");
	});

	it("passes a functioning onChange even when the binding tuple shape changes", async () => {
		// Regression guard: a previous refactor turned SchemaFieldBinding from a
		// plain object into a tuple-with-properties via Object.assign. If a future
		// reshape spreads the binding into the render args, array indices would
		// leak through and `value` / `onChange` would be undefined. This spec
		// fails loudly in that case because onClick would throw and the store
		// would never mutate.
		const store = makeStore(EXAMPLE_DEFAULTS);

		renderReact(
			<SchemaSection
				store={store}
				shape={ExampleSchema.shape}
				fields={["enabled"]}
				overrides={{
					enabled: {
						render: ({ value, onChange }) => (
							<button type="button" data-testid="custom-enabled-control" onClick={() => onChange(!value)}>
								{value ? "on" : "off"}
							</button>
						),
					},
				}}
			/>
		);

		const control = screen.getByTestId("custom-enabled-control");
		expect(control).toHaveTextContent("off");
		expect(typeof control.onclick).toBe("function");
	});
});
