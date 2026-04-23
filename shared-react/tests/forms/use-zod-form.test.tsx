import { act,render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useZodForm } from "../../src/forms/use-zod-form";

const TestSchema = z.object({
	title: z.string().min(1, "Title is required"),
	count: z.number().min(0).max(10),
	enabled: z.boolean(),
});

function TestForm({
	onSubmit,
	onErrors,
	defaults,
}: {
	onSubmit?: (data: z.infer<typeof TestSchema>) => void;
	onErrors?: (errors: Record<string, { message?: string }>) => void;
	defaults: z.infer<typeof TestSchema>;
}) {
	const form = useZodForm({ schema: TestSchema, defaultValues: defaults });
	const errors = form.formState.errors;

	return (
		<form
			onSubmit={form.handleSubmit(
				(data) => onSubmit?.(data),
				(errs) => onErrors?.(errs as Record<string, { message?: string }>)
			)}
		>
			<input data-testid="title" {...form.register("title")} />
			<div data-testid="error-title">{errors.title?.message ?? ""}</div>
			<div data-testid="error-count">{errors.count?.message ?? ""}</div>
			<button type="submit" data-testid="submit">
				Submit
			</button>
		</form>
	);
}

describe("useZodForm", () => {
	it("returns a form bound to the schema with typed defaults", () => {
		const onSubmit = vi.fn();
		render(<TestForm onSubmit={onSubmit} defaults={{ title: "Hello", count: 5, enabled: true }} />);
		const input = screen.getByTestId("title") as HTMLInputElement;
		expect(input.value).toBe("Hello");
	});

	it("propagates validation errors from the Zod schema", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<TestForm onSubmit={onSubmit} defaults={{ title: "", count: 5, enabled: false }} />);

		await user.click(screen.getByTestId("submit"));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(await screen.findByText("Title is required")).toBeInTheDocument();
	});

	it("allows submission when schema is satisfied", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<TestForm onSubmit={onSubmit} defaults={{ title: "Valid", count: 3, enabled: true }} />);

		await user.click(screen.getByTestId("submit"));
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Valid", count: 3, enabled: true }));
	});

	it("blocks submit when number exceeds max", async () => {
		const onSubmit = vi.fn();
		const onErrors = vi.fn();
		const user = userEvent.setup();
		render(
			<TestForm onSubmit={onSubmit} onErrors={onErrors} defaults={{ title: "Valid", count: 99, enabled: false }} />
		);

		await user.click(screen.getByTestId("submit"));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onErrors).toHaveBeenCalledWith(
			expect.objectContaining({
				count: expect.objectContaining({ message: expect.any(String) }),
			})
		);
	});
});
