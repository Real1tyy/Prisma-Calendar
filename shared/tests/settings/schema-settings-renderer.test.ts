/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { renderSchemaSection, renderSchemaSettings } from "../../src/core/settings/schema-settings-renderer";
import type { SchemaSettingsSection } from "../../src/core/settings/schema-settings-types";
import { SettingsStore } from "../../src/core/settings/settings-store";
import { SettingsUIBuilder } from "../../src/core/settings/settings-ui-builder";

vi.mock("obsidian", () => {
	class MockSetting {
		nameEl: HTMLElement | null = null;
		descEl: HTMLElement | null = null;
		controlEl: HTMLElement;

		constructor(public containerEl: HTMLElement) {
			this.containerEl = containerEl;
			this.controlEl = document.createElement("div");
			this.controlEl.className = "setting-item-control";
			(this.controlEl as any).createEl = function (tag: string, options?: any) {
				const el = document.createElement(tag);
				if (options?.type) el.setAttribute("type", options.type);
				if (options?.cls) el.className = options.cls;
				if (options?.value) (el as HTMLInputElement).value = options.value;
				this.appendChild(el);
				return el;
			};
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
			this.descEl = document.createElement("div");
			this.descEl.textContent = desc;
			this.descEl.className = "setting-item-description";
			this.containerEl.appendChild(this.descEl);
			return this;
		}

		setHeading(): this {
			this.containerEl.classList.add("setting-item-heading");
			return this;
		}

		addToggle(callback: (toggle: any) => void): this {
			const toggle = {
				toggleEl: document.createElement("input"),
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			toggle.toggleEl.type = "checkbox";
			toggle.toggleEl.className = "checkbox-toggle";
			this.containerEl.appendChild(toggle.toggleEl);
			toggle.setValue.mockImplementation((value: boolean) => {
				(toggle.toggleEl as HTMLInputElement).checked = value;
				return toggle;
			});
			toggle.onChange.mockImplementation((handler: (value: boolean) => void) => {
				toggle.toggleEl.addEventListener("change", () => handler((toggle.toggleEl as HTMLInputElement).checked));
				return toggle;
			});
			callback(toggle);
			return this;
		}

		addSlider(callback: (slider: any) => void): this {
			const slider = {
				sliderEl: document.createElement("input"),
				setLimits: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
				setDynamicTooltip: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			slider.sliderEl.type = "range";
			slider.sliderEl.className = "slider";
			this.containerEl.appendChild(slider.sliderEl);
			slider.setLimits.mockImplementation((min: number, max: number, step: number) => {
				slider.sliderEl.min = String(min);
				slider.sliderEl.max = String(max);
				slider.sliderEl.step = String(step);
				return slider;
			});
			slider.setValue.mockImplementation((value: number) => {
				slider.sliderEl.value = String(value);
				return slider;
			});
			slider.onChange.mockImplementation((handler: (value: number) => void) => {
				slider.sliderEl.addEventListener("input", () => handler(Number((slider.sliderEl as HTMLInputElement).value)));
				return slider;
			});
			callback(slider);
			return this;
		}

		addText(callback: (text: any) => void): this {
			const text = {
				inputEl: document.createElement("input"),
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			text.inputEl.type = "text";
			text.inputEl.className = "text-input";
			this.containerEl.appendChild(text.inputEl);
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});
			text.onChange.mockImplementation((handler: (value: string) => void) => {
				text.inputEl.addEventListener("input", () => handler(text.inputEl.value));
				return text;
			});
			callback(text);
			return this;
		}

		addTextArea(callback: (text: any) => void): this {
			const text = {
				inputEl: document.createElement("textarea"),
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
			};
			text.inputEl.className = "textarea-input";
			this.containerEl.appendChild(text.inputEl);
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});
			callback(text);
			return this;
		}

		addDropdown(callback: (dropdown: any) => void): this {
			const select = document.createElement("select");
			select.className = "dropdown";
			this.containerEl.appendChild(select);
			const dropdown = {
				selectEl: select,
				addOptions: vi.fn().mockImplementation((options: Record<string, string>) => {
					for (const [value, label] of Object.entries(options)) {
						const option = document.createElement("option");
						option.value = value;
						option.textContent = label;
						select.appendChild(option);
					}
					return dropdown;
				}),
				addOption: vi.fn().mockImplementation((value: string, label: string) => {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = label;
					select.appendChild(option);
					return dropdown;
				}),
				setValue: vi.fn().mockImplementation((value: string) => {
					select.value = value;
					return dropdown;
				}),
				onChange: vi.fn().mockReturnThis(),
			};
			callback(dropdown);
			return this;
		}

		addButton(callback: (button: any) => void): this {
			const button = {
				buttonEl: document.createElement("button"),
				setButtonText: vi.fn().mockReturnThis(),
				setCta: vi.fn().mockReturnThis(),
				setWarning: vi.fn().mockReturnThis(),
				onClick: vi.fn().mockReturnThis(),
				setDisabled: vi.fn().mockReturnThis(),
			};
			button.buttonEl.className = "button";
			this.containerEl.appendChild(button.buttonEl);
			button.setButtonText.mockImplementation((text: string) => {
				button.buttonEl.textContent = text;
				return button;
			});
			button.onClick.mockImplementation((handler: () => void) => {
				button.buttonEl.addEventListener("click", handler);
				return button;
			});
			callback(button);
			return this;
		}

		addColorPicker(callback: (picker: any) => void): this {
			const picker = {
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			callback(picker);
			return this;
		}
	}

	class MockTextComponent {
		inputEl: HTMLInputElement;
		constructor(containerEl: HTMLElement) {
			this.inputEl = document.createElement("input");
			this.inputEl.type = "text";
			containerEl.appendChild(this.inputEl);
		}
		setPlaceholder(placeholder: string): this {
			this.inputEl.placeholder = placeholder;
			return this;
		}
		setValue(value: string): this {
			this.inputEl.value = value;
			return this;
		}
	}

	return {
		Setting: MockSetting,
		TextComponent: MockTextComponent,
		Plugin: vi.fn(),
		Notice: vi.fn(),
	};
});

const NestedSettingsSchema = z.object({
	general: z
		.object({
			showRibbonIcon: z.boolean().catch(true),
			debugMode: z.boolean().catch(false),
			displayName: z.string().catch(""),
		})
		.default({ showRibbonIcon: true, debugMode: false, displayName: "" }),
	notifications: z
		.object({
			enabled: z.boolean().catch(false),
			leadTimeMinutes: z.number().min(0).max(120).catch(15),
			sound: z.enum(["chime", "bell", "none"]).catch("chime"),
		})
		.default({ enabled: false, leadTimeMinutes: 15, sound: "chime" }),
	properties: z
		.object({
			startProp: z.string().catch("start"),
			endProp: z.string().catch("end"),
			allDayProp: z.string().catch("allDay"),
		})
		.default({ startProp: "start", endProp: "end", allDayProp: "allDay" }),
	data: z
		.object({
			tags: z.array(z.string()).catch([]),
			maxRetries: z.number().catch(3),
		})
		.default({ tags: [], maxRetries: 3 }),
});

const DescribedSettingsSchema = z.object({
	general: z
		.object({
			directory: z.string().catch("Projects").describe("Folder to scan for project files"),
			showRibbonIcon: z.boolean().catch(true).describe("Show icon in the left sidebar"),
			debugMode: z.boolean().catch(false).describe("Enable verbose console logging"),
		})
		.default({ directory: "Projects", showRibbonIcon: true, debugMode: false }),
	appearance: z
		.object({
			theme: z.string().catch("default").describe("Color theme to apply"),
			fontSize: z.number().min(8).max(32).catch(14).describe("Base font size in pixels"),
		})
		.default({ theme: "default", fontSize: 14 }),
	version: z.number().catch(1),
});

function addObsidianMethods(el: HTMLElement): void {
	(el as any).createDiv = function (cls?: string) {
		const div = document.createElement("div");
		if (cls) div.className = cls;
		addObsidianMethods(div);
		this.appendChild(div);
		return div;
	};
	(el as any).createEl = function (tag: string, options?: any) {
		const element = document.createElement(tag);
		if (options?.text) element.textContent = options.text;
		if (options?.cls) element.className = options.cls;
		addObsidianMethods(element);
		this.appendChild(element);
		return element;
	};
	(el as any).empty = function () {
		this.innerHTML = "";
	};
	(el as any).setText = function (text: string) {
		this.textContent = text;
	};
}

function createContainer(): HTMLElement {
	const el = document.createElement("div");
	addObsidianMethods(el);
	document.body.appendChild(el);
	return el;
}

function createStore() {
	const mockPlugin = {
		loadData: vi.fn().mockResolvedValue({}),
		saveData: vi.fn().mockResolvedValue(undefined),
	} as any;
	return new SettingsStore(mockPlugin, NestedSettingsSchema);
}

function createDescribedStore() {
	const mockPlugin = {
		loadData: vi.fn().mockResolvedValue({}),
		saveData: vi.fn().mockResolvedValue(undefined),
	} as any;
	return new SettingsStore(mockPlugin, DescribedSettingsSchema);
}

describe("renderSchemaSection", () => {
	let container: HTMLElement;
	let store: SettingsStore<typeof NestedSettingsSchema>;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = createContainer();
		store = createStore();
	});

	it("renders boolean fields as toggles", () => {
		const sectionSchema = NestedSettingsSchema.shape.general;

		renderSchemaSection(container, sectionSchema as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
		});

		const toggles = container.querySelectorAll(".checkbox-toggle");
		expect(toggles.length).toBe(2);
	});

	it("renders string fields as text inputs", () => {
		const sectionSchema = NestedSettingsSchema.shape.properties;

		renderSchemaSection(container, sectionSchema as any, store, "properties", {
			id: "properties",
			label: "Properties",
			schema: "properties",
		});

		const textInputs = container.querySelectorAll('input[type="text"]');
		expect(textInputs.length).toBe(3);
	});

	it("renders number fields with min+max as sliders", () => {
		const sectionSchema = NestedSettingsSchema.shape.notifications;

		renderSchemaSection(container, sectionSchema as any, store, "notifications", {
			id: "notifications",
			label: "Notifications",
			schema: "notifications",
		});

		const sliders = container.querySelectorAll('input[type="range"]');
		expect(sliders.length).toBe(1);
	});

	it("renders enum fields as dropdowns", () => {
		const sectionSchema = NestedSettingsSchema.shape.notifications;

		renderSchemaSection(container, sectionSchema as any, store, "notifications", {
			id: "notifications",
			label: "Notifications",
			schema: "notifications",
		});

		const dropdowns = container.querySelectorAll("select.dropdown");
		expect(dropdowns.length).toBe(1);

		const options = dropdowns[0].querySelectorAll("option");
		expect(options.length).toBe(3);
	});

	it("renders number fields without bounds as number inputs", () => {
		const sectionSchema = NestedSettingsSchema.shape.data;
		const spy = vi.spyOn(SettingsUIBuilder.prototype, "addNumberInput");

		renderSchemaSection(container, sectionSchema as any, store, "data", { id: "data", label: "Data", schema: "data" });

		expect(spy).toHaveBeenCalledWith(container, expect.objectContaining({ key: "data.maxRetries" }));
		spy.mockRestore();
	});

	it("applies field overrides for label and desc", () => {
		const sectionSchema = NestedSettingsSchema.shape.general;

		renderSchemaSection(container, sectionSchema as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
			overrides: {
				showRibbonIcon: {
					label: "Sidebar Icon",
					desc: "Show the plugin icon in the sidebar",
				},
			},
		});

		const names = container.querySelectorAll(".setting-item-name");
		const nameTexts = Array.from(names).map((n) => n.textContent);
		expect(nameTexts).toContain("Sidebar Icon");

		const descs = container.querySelectorAll(".setting-item-description");
		const descTexts = Array.from(descs).map((d) => d.textContent);
		expect(descTexts).toContain("Show the plugin icon in the sidebar");
	});

	it("skips hidden fields", () => {
		const sectionSchema = NestedSettingsSchema.shape.general;

		renderSchemaSection(container, sectionSchema as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
			overrides: {
				debugMode: { hidden: true },
			},
		});

		const toggles = container.querySelectorAll(".checkbox-toggle");
		expect(toggles.length).toBe(1);
	});

	it("respects fieldOrder", () => {
		const sectionSchema = NestedSettingsSchema.shape.properties;
		const spy = vi.spyOn(SettingsUIBuilder.prototype, "addText");

		renderSchemaSection(container, sectionSchema as any, store, "properties", {
			id: "properties",
			label: "Properties",
			schema: "properties",
			fieldOrder: ["allDayProp", "endProp", "startProp"],
		});

		const keys = spy.mock.calls.map((call) => (call[1] as any).key);
		expect(keys).toEqual(["properties.allDayProp", "properties.endProp", "properties.startProp"]);
		spy.mockRestore();
	});

	it("renders group headings", () => {
		const sectionSchema = NestedSettingsSchema.shape.properties;

		renderSchemaSection(container, sectionSchema as any, store, "properties", {
			id: "properties",
			label: "Properties",
			schema: "properties",
			groups: [
				{ heading: "Time Properties", fields: ["startProp", "endProp"] },
				{ heading: "Display Properties", fields: ["allDayProp"] },
			],
		});

		const names = container.querySelectorAll(".setting-item-name");
		const nameTexts = Array.from(names).map((n) => n.textContent);
		expect(nameTexts).toContain("Time Properties");
		expect(nameTexts).toContain("Display Properties");
	});

	it("calls before and after closures in order", () => {
		const sectionSchema = NestedSettingsSchema.shape.general;
		const callOrder: string[] = [];

		renderSchemaSection(container, sectionSchema as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
			before: (el) => {
				callOrder.push("before");
				el.createEl("div", { cls: "before-marker" });
			},
			after: (el) => {
				callOrder.push("after");
				el.createEl("div", { cls: "after-marker" });
			},
		});

		expect(callOrder).toEqual(["before", "after"]);
		expect(container.querySelector(".before-marker")).toBeTruthy();
		expect(container.querySelector(".after-marker")).toBeTruthy();

		const children = Array.from(container.children);
		const beforeIndex = children.findIndex((c) => c.classList.contains("before-marker"));
		const afterIndex = children.findIndex((c) => c.classList.contains("after-marker"));
		expect(beforeIndex).toBeLessThan(afterIndex);
	});

	it("uses custom render override instead of default rendering", () => {
		const sectionSchema = NestedSettingsSchema.shape.general;
		const renderFn = vi.fn((el: HTMLElement) => {
			el.createEl("div", { cls: "custom-rendered" });
		});

		renderSchemaSection(container, sectionSchema as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
			overrides: {
				showRibbonIcon: { type: "custom", render: renderFn },
			},
		});

		expect(renderFn).toHaveBeenCalledTimes(1);
		expect(container.querySelector(".custom-rendered")).toBeTruthy();
	});

	it("renders enum override options instead of schema values", () => {
		const sectionSchema = NestedSettingsSchema.shape.notifications;

		renderSchemaSection(container, sectionSchema as any, store, "notifications", {
			id: "notifications",
			label: "Notifications",
			schema: "notifications",
			overrides: {
				sound: {
					type: "dropdown",
					options: { chime: "Chime Sound", bell: "Bell Sound" },
				},
			},
		});

		const dropdowns = container.querySelectorAll("select.dropdown");
		expect(dropdowns.length).toBe(1);

		const options = dropdowns[0].querySelectorAll("option");
		const labels = Array.from(options).map((o) => o.textContent);
		expect(labels).toContain("Chime Sound");
		expect(labels).toContain("Bell Sound");
	});

	it("renders array fields as text arrays", () => {
		const sectionSchema = NestedSettingsSchema.shape.data;
		const spy = vi.spyOn(SettingsUIBuilder.prototype, "addTextArray");

		renderSchemaSection(container, sectionSchema as any, store, "data", { id: "data", label: "Data", schema: "data" });

		expect(spy).toHaveBeenCalledWith(container, expect.objectContaining({ key: "data.tags" }));
		spy.mockRestore();
	});
});

describe("renderSchemaSettings", () => {
	let container: HTMLElement;
	let store: SettingsStore<typeof NestedSettingsSchema>;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = createContainer();
		store = createStore();
	});

	it("creates navigation with all sections", () => {
		const sections: SchemaSettingsSection[] = [
			{ id: "general", label: "General", schema: "general" },
			{ id: "notifications", label: "Notifications", schema: "notifications" },
			{ id: "properties", label: "Properties", schema: "properties" },
		];

		const nav = renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
			sections,
		});

		expect(nav).toBeDefined();

		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts).toContain("General");
		expect(buttonTexts).toContain("Notifications");
		expect(buttonTexts).toContain("Properties");
	});

	it("renders first section content by default", () => {
		renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
			sections: [
				{ id: "general", label: "General", schema: "general" },
				{ id: "notifications", label: "Notifications", schema: "notifications" },
			],
		});

		const toggles = container.querySelectorAll(".checkbox-toggle");
		expect(toggles.length).toBeGreaterThan(0);
	});

	it("passes footer links to navigation", () => {
		renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
			sections: [{ id: "general", label: "General", schema: "general" }],
			footerLinks: [{ text: "Documentation", href: "https://example.com" }],
		});

		const links = container.querySelectorAll("a");
		const linkTexts = Array.from(links).map((a) => a.textContent);
		expect(linkTexts).toContain("Documentation");
	});
});

describe("Zod .describe() metadata", () => {
	let container: HTMLElement;
	let store: SettingsStore<typeof DescribedSettingsSchema>;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = createContainer();
		store = createDescribedStore();
	});

	it("renders field descriptions from .describe()", () => {
		renderSchemaSection(container, DescribedSettingsSchema.shape.general as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
		});

		const descs = container.querySelectorAll(".setting-item-description");
		const descTexts = Array.from(descs).map((d) => d.textContent);
		expect(descTexts).toContain("Folder to scan for project files");
		expect(descTexts).toContain("Show icon in the left sidebar");
		expect(descTexts).toContain("Enable verbose console logging");
	});

	it("override desc takes priority over .describe()", () => {
		renderSchemaSection(container, DescribedSettingsSchema.shape.general as any, store, "general", {
			id: "general",
			label: "General",
			schema: "general",
			overrides: {
				directory: { desc: "Custom override description" },
			},
		});

		const descs = container.querySelectorAll(".setting-item-description");
		const descTexts = Array.from(descs).map((d) => d.textContent);
		expect(descTexts).toContain("Custom override description");
		expect(descTexts).not.toContain("Folder to scan for project files");
	});

	it("fields without .describe() render with empty description", () => {
		const plainSchema = z.object({
			general: z
				.object({
					name: z.string().catch(""),
				})
				.default({ name: "" }),
		});
		const plainStore = new SettingsStore(
			{ loadData: vi.fn().mockResolvedValue({}), saveData: vi.fn().mockResolvedValue(undefined) } as any,
			plainSchema
		);

		renderSchemaSection(container, plainSchema.shape.general as any, plainStore, "general", {
			id: "general",
			label: "General",
			schema: "general",
		});

		const descs = container.querySelectorAll(".setting-item-description");
		const descTexts = Array.from(descs).map((d) => d.textContent);
		expect(descTexts).toEqual([""]);
	});
});

describe("auto-derived sections", () => {
	let container: HTMLElement;
	let store: SettingsStore<typeof DescribedSettingsSchema>;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = createContainer();
		store = createDescribedStore();
	});

	it("derives sections from top-level object keys", () => {
		const nav = renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
		});

		expect(nav).toBeDefined();
		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts).toContain("General");
		expect(buttonTexts).toContain("Appearance");
	});

	it("excludes non-object keys from auto-sections", () => {
		const nav = renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
		});

		expect(nav).toBeDefined();
		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts).not.toContain("Version");
	});

	it("applies sectionOverrides to auto-derived sections", () => {
		renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
			sectionOverrides: {
				general: { label: "Settings" },
			},
		});

		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts).toContain("Settings");
		expect(buttonTexts).not.toContain("General");
	});

	it("excludes keys listed in exclude", () => {
		renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
			exclude: ["appearance"],
		});

		const buttons = container.querySelectorAll("button");
		const buttonTexts = Array.from(buttons).map((b) => b.textContent);
		expect(buttonTexts).toContain("General");
		expect(buttonTexts).not.toContain("Appearance");
	});

	it("renders described fields in auto-derived sections", () => {
		renderSchemaSettings({
			containerEl: container,
			settingsStore: store,
			cssPrefix: "test",
		});

		const descs = container.querySelectorAll(".setting-item-description");
		const descTexts = Array.from(descs).map((d) => d.textContent);
		expect(descTexts).toContain("Folder to scan for project files");
	});
});
