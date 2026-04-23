import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { FormDropdown, FormNumberInput, FormTextInput, FormToggle } from "../../src/forms/controls";
import { useZodForm } from "../../src/forms/use-zod-form";
import { renderReact } from "../helpers/render-react";

const Schema = z.object({
	name: z.string(),
	age: z.number(),
	active: z.boolean(),
	mode: z.enum(["light", "dark"]),
});

function TestWrapper({
	field,
	children,
}: {
	field: string;
	children: (form: ReturnType<typeof useZodForm<typeof Schema>>) => React.ReactNode;
}) {
	const form = useZodForm({
		schema: Schema,
		defaultValues: { name: "Alice", age: 25, active: true, mode: "light" as const },
	});
	return <div data-testid={`wrapper-${field}`}>{children(form)}</div>;
}

describe("FormToggle", () => {
	it("renders with the bound value and toggles on click", async () => {
		const { user } = renderReact(
			<TestWrapper field="toggle">{(form) => <FormToggle form={form} name="active" testId="toggle" />}</TestWrapper>
		);

		const toggle = screen.getByTestId("toggle");
		expect(toggle).toHaveAttribute("aria-checked", "true");

		await user.click(toggle);
		expect(toggle).toHaveAttribute("aria-checked", "false");
	});
});

describe("FormTextInput", () => {
	it("renders with bound value and updates on type", async () => {
		const { user } = renderReact(
			<TestWrapper field="text">
				{(form) => <FormTextInput form={form} name="name" placeholder="Enter name" testId="text" />}
			</TestWrapper>
		);

		const input = screen.getByTestId("text") as HTMLInputElement;
		expect(input.value).toBe("Alice");

		await user.clear(input);
		await user.type(input, "Bob");
		expect(input.value).toBe("Bob");
	});
});

describe("FormNumberInput", () => {
	it("renders with bound value", () => {
		renderReact(
			<TestWrapper field="number">
				{(form) => <FormNumberInput form={form} name="age" min={0} max={150} testId="number" />}
			</TestWrapper>
		);

		const input = screen.getByTestId("number") as HTMLInputElement;
		expect(input.value).toBe("25");
	});
});

describe("FormDropdown", () => {
	it("renders with bound value and updates on selection", async () => {
		const { user } = renderReact(
			<TestWrapper field="dropdown">
				{(form) => (
					<FormDropdown form={form} name="mode" options={{ light: "Light", dark: "Dark" }} testId="dropdown" />
				)}
			</TestWrapper>
		);

		const select = screen.getByTestId("dropdown") as HTMLSelectElement;
		expect(select.value).toBe("light");

		await user.selectOptions(select, "dark");
		expect(select.value).toBe("dark");
	});
});
