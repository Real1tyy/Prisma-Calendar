import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SchemaForm } from "../../src/forms/schema-form";
import { useZodForm } from "../../src/forms/use-zod-form";
import { renderReact } from "../helpers/render-react";

const FormSchema = z.object({
	title: z.string().min(1, "Title is required").default("").describe("Event title"),
	count: z.number().min(0).max(10).default(0).describe("Item count"),
	enabled: z.boolean().default(false).describe("Toggle feature"),
	mode: z.enum(["light", "dark", "auto"]).default("auto").describe("Display mode"),
});

function TestForm({
	onSubmit,
	overrides,
	sections,
	testIdPrefix,
}: {
	onSubmit?: (data: z.infer<typeof FormSchema>) => void;
	overrides?: React.ComponentProps<typeof SchemaForm>["fieldOverrides"];
	sections?: React.ComponentProps<typeof SchemaForm>["sections"];
	testIdPrefix?: string;
}) {
	const form = useZodForm({
		schema: FormSchema,
		defaultValues: { title: "", count: 0, enabled: false, mode: "auto" as const },
	});
	return (
		<form onSubmit={form.handleSubmit(onSubmit ?? (() => {}))}>
			<SchemaForm
				form={form}
				schema={FormSchema}
				fieldOverrides={overrides}
				sections={sections}
				testIdPrefix={testIdPrefix}
			/>
			<button type="submit" data-testid="submit">
				Submit
			</button>
		</form>
	);
}

describe("SchemaForm", () => {
	it("renders a field for each schema key with auto-derived labels", () => {
		renderReact(<TestForm />);

		expect(screen.getByText("Title")).toBeInTheDocument();
		expect(screen.getByText("Count")).toBeInTheDocument();
		expect(screen.getByText("Enabled")).toBeInTheDocument();
		expect(screen.getByText("Mode")).toBeInTheDocument();
	});

	it("renders the correct control type per descriptor", () => {
		renderReact(<TestForm />);

		expect(screen.getByRole("switch")).toBeInTheDocument();
		const selects = screen.getAllByRole("combobox");
		expect(selects.length).toBeGreaterThanOrEqual(1);
	});

	it("uses field overrides for labels and hidden", () => {
		renderReact(
			<TestForm
				overrides={{
					title: { label: "Custom Title" },
					count: { hidden: true },
				}}
			/>
		);

		expect(screen.getByText("Custom Title")).toBeInTheDocument();
		expect(screen.queryByText("Count")).not.toBeInTheDocument();
	});

	it("renders sections with headings in order", () => {
		renderReact(
			<TestForm
				sections={[
					{ heading: "Basic", fields: ["title", "enabled"] },
					{ heading: "Advanced", fields: ["count", "mode"] },
				]}
			/>
		);

		const headings = screen.getAllByText(/Basic|Advanced/);
		expect(headings).toHaveLength(2);
		expect(headings[0]).toHaveTextContent("Basic");
		expect(headings[1]).toHaveTextContent("Advanced");
	});

	it("shows validation error on submit with invalid data", async () => {
		const onSubmit = vi.fn();
		const { user } = renderReact(<TestForm onSubmit={onSubmit} />);

		await user.click(screen.getByTestId("submit"));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(await screen.findByText("Title is required")).toBeInTheDocument();
	});

	it("stamps data-testid when testIdPrefix is provided", () => {
		renderReact(<TestForm testIdPrefix="prisma-form-" />);

		expect(screen.getByTestId("prisma-form-field-title")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-form-field-enabled")).toBeInTheDocument();
	});

	it("supports custom render override", () => {
		renderReact(
			<TestForm
				overrides={{
					title: {
						render: ({ name }) => <span data-testid="custom-render">Custom: {name}</span>,
					},
				}}
			/>
		);

		expect(screen.getByTestId("custom-render")).toHaveTextContent("Custom: title");
	});
});
