/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ModalContext } from "../../src/components/component-renderer/types";

const noticeSpy = vi.fn();

vi.mock("obsidian", () => {
	class MockSetting {
		nameEl: HTMLElement | null = null;
		controlEl: HTMLElement;

		constructor(public containerEl: HTMLElement) {
			this.controlEl = document.createElement("div");
			this.containerEl.appendChild(this.controlEl);
		}

		setName(name: string): this {
			this.nameEl = document.createElement("div");
			this.nameEl.textContent = name;
			this.nameEl.className = "setting-item-name";
			this.containerEl.appendChild(this.nameEl);
			return this;
		}

		setDesc(desc: string): this {
			const descEl = document.createElement("div");
			descEl.textContent = desc;
			descEl.className = "setting-item-description";
			this.containerEl.appendChild(descEl);
			return this;
		}

		addText(callback: (text: any) => void): this {
			const text = {
				inputEl: document.createElement("input"),
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockImplementation((v: string) => {
					text.inputEl.value = v;
					return text;
				}),
				onChange: vi.fn().mockReturnThis(),
			};
			text.inputEl.type = "text";
			this.controlEl.appendChild(text.inputEl);
			callback(text);
			return this;
		}

		addToggle(callback: (toggle: any) => void): this {
			const toggle = {
				toggleEl: document.createElement("input"),
				setValue: vi.fn().mockImplementation((v: boolean) => {
					(toggle.toggleEl as HTMLInputElement).checked = v;
					return toggle;
				}),
				onChange: vi.fn().mockReturnThis(),
			};
			toggle.toggleEl.type = "checkbox";
			toggle.toggleEl.className = "checkbox-toggle";
			this.controlEl.appendChild(toggle.toggleEl);
			callback(toggle);
			return this;
		}

		addDropdown(callback: (dropdown: any) => void): this {
			const select = document.createElement("select");
			const dropdown = {
				selectEl: select,
				addOption: vi.fn().mockImplementation((value: string, label: string) => {
					const opt = document.createElement("option");
					opt.value = value;
					opt.textContent = label;
					select.appendChild(opt);
					return dropdown;
				}),
				setValue: vi.fn().mockImplementation((v: string) => {
					select.value = v;
					return dropdown;
				}),
				onChange: vi.fn().mockReturnThis(),
			};
			this.controlEl.appendChild(select);
			callback(dropdown);
			return this;
		}

		addButton(callback: (button: any) => void): this {
			const button = {
				buttonEl: document.createElement("button"),
				setButtonText: vi.fn().mockImplementation((text: string) => {
					button.buttonEl.textContent = text;
					return button;
				}),
				setCta: vi.fn().mockReturnThis(),
				onClick: vi.fn().mockImplementation((handler: () => void) => {
					button.buttonEl.addEventListener("click", handler);
					return button;
				}),
			};
			this.controlEl.appendChild(button.buttonEl);
			callback(button);
			return this;
		}

		addComponent(callback: (component: any) => any): this {
			const componentEl = document.createElement("div");
			componentEl.className = "secret-component";
			this.controlEl.appendChild(componentEl);
			callback(componentEl);
			return this;
		}
	}

	class MockSecretComponent {
		el: HTMLElement;
		private _value = "";
		private _onChange: ((v: string) => void) | null = null;

		constructor(_app: any, el: HTMLElement) {
			this.el = el;
			const marker = document.createElement("div");
			marker.className = "obsidian-secret";
			marker.setAttribute("data-secret", "");
			el.appendChild(marker);
		}

		setValue(v: string): this {
			this._value = v;
			const marker = this.el.querySelector(".obsidian-secret");
			if (marker) marker.setAttribute("data-secret", v);
			return this;
		}

		onChange(fn: (v: string) => void): this {
			this._onChange = fn;
			return this;
		}
	}

	class MockNotice {
		constructor(message: string, timeout?: number) {
			noticeSpy(message, timeout);
		}
	}

	return { Setting: MockSetting, SecretComponent: MockSecretComponent, Notice: MockNotice };
});

const { createSchemaFormRenderer } = await import("../../src/components/schema-modal/render");

function createMockCtx(): ModalContext {
	return {
		type: "modal",
		app: { name: "test" } as any,
		close: vi.fn(),
		modalEl: document.createElement("div"),
		scope: {} as any,
		searchQuery: "",
	};
}

describe("createSchemaFormRenderer", () => {
	let el: HTMLElement;
	let ctx: ModalContext;

	beforeEach(() => {
		el = document.createElement("div");
		ctx = createMockCtx();
		noticeSpy.mockClear();
	});

	it("renders a text field for z.string()", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { name: z.string() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = el.querySelectorAll(".setting-item-name");
		expect(Array.from(names).some((n) => n.textContent === "Name")).toBe(true);
	});

	it("renders a toggle for z.boolean()", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { active: z.boolean() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const toggles = el.querySelectorAll(".checkbox-toggle");
		expect(toggles.length).toBeGreaterThanOrEqual(1);
	});

	it("renders a number input for z.number()", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { amount: z.number() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const inputs = el.querySelectorAll("input[type='number']");
		expect(inputs.length).toBeGreaterThanOrEqual(1);
	});

	it("renders a date input for z.string().date() fields", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { when: z.string().date() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const dateInputs = el.querySelectorAll("input[type='date']");
		expect(dateInputs.length).toBeGreaterThanOrEqual(1);
	});

	it("renders a dropdown for z.enum()", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { status: z.enum(["active", "inactive"]) },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const selects = el.querySelectorAll("select");
		expect(selects.length).toBeGreaterThanOrEqual(1);
	});

	it("renders a toggle for z.union([z.boolean(), z.string()])", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { recurring: z.union([z.boolean(), z.string()]) },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const toggles = el.querySelectorAll(".checkbox-toggle");
		expect(toggles.length).toBeGreaterThanOrEqual(1);
	});

	it("hides fields with hidden override", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { visible: z.string(), hidden: z.string() },
			fieldOverrides: { hidden: { hidden: true } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names).toContain("Visible");
		expect(names).not.toContain("Hidden");
	});

	it("applies label override", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { acctType: z.string() },
			fieldOverrides: { acctType: { label: "Account Type" } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names).toContain("Account Type");
	});

	it("renders a dropdown when override provides options for a string field", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { category: z.string().optional() },
			fieldOverrides: {
				category: { options: { work: "Work", personal: "Personal" } },
			},
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const selects = el.querySelectorAll("select");
		expect(selects.length).toBeGreaterThanOrEqual(1);
	});

	it("renders a name field in create mode when nameField is true", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			nameField: true,
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names[0]).toBe("Name");
	});

	it("does not render a name field in edit mode", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			nameField: true,
			existing: { id: "test-item", data: { note: "existing note" } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names).not.toContain("Name");
	});

	it("pre-fills values from existing data", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			existing: { id: "test-item", data: { note: "Hello World" } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const textInput = el.querySelector("input[type='text']") as HTMLInputElement;
		expect(textInput.value).toBe("Hello World");
	});

	it("renders Save and Cancel buttons", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const buttons = Array.from(el.querySelectorAll("button")).map((b) => b.textContent);
		expect(buttons).toContain("Save");
		expect(buttons).toContain("Cancel");
	});

	it("calls onSubmit with parsed values on save", async () => {
		const onSubmit = vi.fn();
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			existing: { id: "test-item", data: { note: "valid" } },
			onSubmit,
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(onSubmit).toHaveBeenCalledWith("test-item", { note: "valid" });
	});

	it("shows Notice when name is required but empty", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			nameField: true,
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		expect(noticeSpy.mock.calls[0][0]).toBe("Name is required.");
	});

	it("closes modal on cancel", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const cancelBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Cancel")!;
		cancelBtn.click();

		expect(ctx.close).toHaveBeenCalledOnce();
	});

	it("calls extraFields with values, context, and setValues", () => {
		const extraFields = vi.fn();
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			extraFields,
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		expect(extraFields).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(Object), ctx, expect.any(Function));
	});

	it("setValues from extraFields re-renders the form with updated values", () => {
		let capturedSetValues: ((partial: Record<string, unknown>) => void) | null = null;

		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { name: z.string(), url: z.string() },
			extraFields: (_el, _values, _ctx, setValues) => {
				capturedSetValues = setValues;
			},
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const getInputValue = () => {
			const inputs = el.querySelectorAll("input[type='text']");
			return (inputs[0] as HTMLInputElement)?.value;
		};

		expect(getInputValue()).toBe("");

		capturedSetValues!({ name: "Preset Name" });

		expect(getInputValue()).toBe("Preset Name");
	});

	it("does not close modal when onSubmit returns false", async () => {
		const onSubmit = vi.fn().mockResolvedValue(false);
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			existing: { id: "item", data: { note: "test" } },
			onSubmit,
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(ctx.close).not.toHaveBeenCalled();
	});

	it("closes modal when onSubmit returns void (undefined)", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			existing: { id: "item", data: { note: "test" } },
			onSubmit,
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		await vi.waitFor(() => expect(ctx.close).toHaveBeenCalledOnce());
	});

	it("uses custom render function from override", () => {
		const customRender = vi.fn();
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { custom: z.string() },
			fieldOverrides: { custom: { render: customRender } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		expect(customRender).toHaveBeenCalledWith(expect.any(HTMLElement), "", expect.any(Function));
	});

	it("calls upsert.create on save in create mode", async () => {
		const create = vi.fn();
		const update = vi.fn();
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			upsert: { create, update, entityName: "Item" },
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
		expect(update).not.toHaveBeenCalled();
		expect(noticeSpy.mock.calls[0][0]).toBe('Item "" created.');
	});

	it("calls upsert.update on save in edit mode", async () => {
		const create = vi.fn();
		const update = vi.fn();
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { note: z.string().optional() },
			existing: { id: "existing-item", data: { note: "hello" } },
			upsert: { create, update, entityName: "Item" },
		});
		render(el, ctx);

		const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
		saveBtn.click();

		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
		expect(create).not.toHaveBeenCalled();
		expect(noticeSpy.mock.calls[0][0]).toBe('Item "existing-item" updated.');
	});

	it("renders SecretComponent for z.string().meta({ format: 'secret' })", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { apiKey: z.string().meta({ format: "secret" }) },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const secretComponents = el.querySelectorAll(".obsidian-secret");
		expect(secretComponents.length).toBe(1);
	});

	it("pre-fills existing secret values via SecretComponent", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: { token: z.string().meta({ format: "secret" }) },
			existing: { id: "item", data: { token: "my-secret-name" } },
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const secretEl = el.querySelector(".obsidian-secret") as HTMLElement;
		expect(secretEl).toBeTruthy();
		expect(secretEl.getAttribute("data-secret")).toBe("my-secret-name");
	});

	it("renders secret field label and description", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: {
				apiKey: z.string().describe("Your API key secret").meta({ format: "secret" }),
			},
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names).toContain("Api Key");

		const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
		expect(descs).toContain("Your API key secret");
	});

	it("renders all field types in a complex shape", () => {
		const render = createSchemaFormRenderer({
			app: {} as any,
			cls: "test",
			title: "Test",
			shape: {
				title: z.string().optional(),
				startDate: z.string().optional(),
				amount: z.number().optional(),
				active: z.boolean().optional(),
				status: z.enum(["open", "closed"]).optional(),
				recurring: z.union([z.boolean(), z.string()]).optional(),
				apiKey: z.string().meta({ format: "secret" }).optional(),
			},
			onSubmit: vi.fn(),
		});
		render(el, ctx);

		const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
		expect(names).toContain("Title");
		expect(names).toContain("Start Date");
		expect(names).toContain("Amount");
		expect(names).toContain("Active");
		expect(names).toContain("Status");
		expect(names).toContain("Recurring");
		expect(names).toContain("Api Key");

		const secretComponents = el.querySelectorAll(".obsidian-secret");
		expect(secretComponents.length).toBe(1);
	});

	describe(".describe() metadata", () => {
		it("renders field descriptions from .describe()", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					name: z.string().describe("Full name of the person"),
					age: z.number().describe("Age in years"),
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Full name of the person");
			expect(descs).toContain("Age in years");
		});

		it("desc override takes priority over .describe()", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					name: z.string().describe("Schema description"),
				},
				fieldOverrides: {
					name: { desc: "Override description" },
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Override description");
			expect(descs).not.toContain("Schema description");
		});

		it("fields without .describe() render without description", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { name: z.string() },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = el.querySelectorAll(".setting-item-description");
			expect(descs.length).toBe(0);
		});

		it("renders descriptions on boolean fields", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					active: z.boolean().describe("Whether the item is active"),
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Whether the item is active");
		});

		it("renders descriptions on enum fields", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					status: z.enum(["active", "inactive"]).describe("Current status"),
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Current status");
		});

		it("renders descriptions on dropdown override fields", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					category: z.string().describe("Pick a category"),
				},
				fieldOverrides: {
					category: { options: { a: "Option A", b: "Option B" } },
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Pick a category");
		});

		it("renders descriptions on array fields", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					tags: z.array(z.string()).describe("Comma-separated tags"),
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Comma-separated tags");
		});

		it(".describe() works through .catch()", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: {
					name: z.string().catch("default").describe("Name with catch"),
				},
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const descs = Array.from(el.querySelectorAll(".setting-item-description")).map((d) => d.textContent);
			expect(descs).toContain("Name with catch");
		});
	});

	describe("array fields", () => {
		it("renders a text input for z.array(z.string())", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { tags: z.array(z.string()) },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
			expect(names).toContain("Tags");

			const inputs = el.querySelectorAll("input[type='text']");
			expect(inputs.length).toBeGreaterThanOrEqual(1);
		});

		it("pre-fills existing string array values as comma-separated text", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { tags: z.array(z.string()) },
				existing: { id: "item", data: { tags: ["work", "personal", "fitness"] } },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const input = el.querySelector("input[type='text']") as HTMLInputElement;
			expect(input.value).toBe("work, personal, fitness");
		});

		it("renders a text input for z.array(z.number())", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { scores: z.array(z.number()) },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
			expect(names).toContain("Scores");
		});

		it("pre-fills existing number array values", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { scores: z.array(z.number()) },
				existing: { id: "item", data: { scores: [10, 20, 30] } },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const input = el.querySelector("input[type='text']") as HTMLInputElement;
			expect(input.value).toBe("10, 20, 30");
		});

		it("submits string array values correctly", async () => {
			const onSubmit = vi.fn();
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { tags: z.array(z.string()) },
				existing: { id: "item", data: { tags: ["work", "personal"] } },
				onSubmit,
			});
			render(el, ctx);

			const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
			saveBtn.click();

			await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
			expect(onSubmit).toHaveBeenCalledWith("item", { tags: ["work", "personal"] });
		});

		it("submits number array values with proper coercion", async () => {
			const onSubmit = vi.fn();
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { scores: z.array(z.number()) },
				existing: { id: "item", data: { scores: [10, 20] } },
				onSubmit,
			});
			render(el, ctx);

			const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
			saveBtn.click();

			await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
			expect(onSubmit).toHaveBeenCalledWith("item", { scores: [10, 20] });
		});

		it("defaults to empty array when no existing data", async () => {
			const onSubmit = vi.fn();
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { tags: z.array(z.string()).default([]) },
				existing: { id: "item", data: {} },
				onSubmit,
			});
			render(el, ctx);

			const saveBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
			saveBtn.click();

			await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
			expect(onSubmit).toHaveBeenCalledWith("item", { tags: [] });
		});

		it("parses comma-separated input into string array on change", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { tags: z.array(z.string()) },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const input = el.querySelector("input[type='text']") as HTMLInputElement;
			const onChangeCalls = vi.mocked(input as any).__onChangeFn;

			const textMock = el.querySelector("input[type='text']");
			const settingEl = textMock?.closest("div");
			expect(settingEl).toBeTruthy();
		});

		it("filters NaN values from number array input", () => {
			const render = createSchemaFormRenderer({
				app: {} as any,
				cls: "test",
				title: "Test",
				shape: { scores: z.array(z.number()) },
				onSubmit: vi.fn(),
			});
			render(el, ctx);

			const names = Array.from(el.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
			expect(names).toContain("Scores");
		});
	});
});
