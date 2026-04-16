/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SettingsStore, SettingsUIBuilder } from "../../src/core/settings";

// Mock Obsidian
vi.mock("obsidian", () => {
	class MockSetting {
		nameEl: HTMLElement | null = null;
		descEl: HTMLElement | null = null;
		controlEl: HTMLElement;

		constructor(public containerEl: HTMLElement) {
			this.containerEl = containerEl;
			this.controlEl = document.createElement("div");
			this.controlEl.className = "setting-item-control";
			// Add createEl for dynamic element creation
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

			// Wire up setValue to actually set the checkbox
			toggle.setValue.mockImplementation((value: boolean) => {
				(toggle.toggleEl as HTMLInputElement).checked = value;
				return toggle;
			});

			// Wire up onChange to actually update the checkbox
			toggle.onChange.mockImplementation((handler: (value: boolean) => void) => {
				toggle.toggleEl.addEventListener("change", () => {
					const value = (toggle.toggleEl as HTMLInputElement).checked;
					handler(value);
				});
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

			// Wire up setLimits to actually set attributes
			slider.setLimits.mockImplementation((min: number, max: number, step: number) => {
				slider.sliderEl.min = String(min);
				slider.sliderEl.max = String(max);
				slider.sliderEl.step = String(step);
				return slider;
			});

			// Wire up setValue to actually set value
			slider.setValue.mockImplementation((value: number) => {
				slider.sliderEl.value = String(value);
				return slider;
			});

			// Wire up onChange to actually trigger on input
			slider.onChange.mockImplementation((handler: (value: number) => void) => {
				slider.sliderEl.addEventListener("input", () => {
					const value = Number((slider.sliderEl as HTMLInputElement).value);
					handler(value);
				});
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

			// Wire up setPlaceholder
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});

			// Wire up setValue
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});

			// Wire up onChange to actually trigger on input
			text.onChange.mockImplementation((handler: (value: string) => void) => {
				text.inputEl.addEventListener("input", () => {
					handler(text.inputEl.value);
				});
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

			// Wire up setPlaceholder
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});

			// Wire up setValue
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});

			callback(text);
			return this;
		}

		addDropdown(callback: (dropdown: any) => void): this {
			const selectEl = document.createElement("select");
			selectEl.className = "dropdown";
			this.containerEl.appendChild(selectEl);
			const dropdown = {
				selectEl,
				addOptions: vi.fn().mockImplementation((options: Record<string, string>) => {
					for (const [value, label] of Object.entries(options)) {
						const option = document.createElement("option");
						option.value = value;
						option.text = label;
						selectEl.appendChild(option);
					}
					return dropdown;
				}),
				setValue: vi.fn().mockImplementation((value: string) => {
					selectEl.value = value;
					return dropdown;
				}),
				onChange: vi.fn().mockImplementation((handler: (value: string) => void) => {
					selectEl.addEventListener("change", () => handler(selectEl.value));
					return dropdown;
				}),
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

			// Wire up setButtonText
			button.setButtonText.mockImplementation((text: string) => {
				button.buttonEl.textContent = text;
				return button;
			});

			// Wire up onClick
			button.onClick.mockImplementation((handler: () => void) => {
				button.buttonEl.addEventListener("click", handler);
				return button;
			});

			// Wire up setDisabled
			button.setDisabled.mockImplementation((disabled: boolean) => {
				button.buttonEl.disabled = disabled;
				return button;
			});

			callback(button);
			return this;
		}
	}

	return {
		Setting: MockSetting,
		Plugin: vi.fn(),
	};
});

// Test schema
const TestSchema = z.object({
	enabled: z.boolean().default(false),
	maxItems: z.number().default(10),
	username: z.string().default(""),
	tags: z.array(z.string()).default([]),
	directories: z.array(z.string()).default(["*"]),
});

// Nested test schema for testing dot notation
const NestedTestSchema = z.object({
	simple: z.string().default("test"),
	nested: z
		.object({
			enabled: z.boolean().default(false),
			count: z.number().min(0).max(100).default(10),
			name: z.string().default(""),
			tags: z.array(z.string()).default([]),
			items: z.array(z.string()).default(["item1"]),
		})
		.default({
			enabled: false,
			count: 10,
			name: "",
			tags: [],
			items: ["item1"],
		}),
	deeplyNested: z
		.object({
			level1: z
				.object({
					level2: z
						.object({
							value: z.string().default("deep"),
						})
						.default({
							value: "deep",
						}),
				})
				.default({
					level2: {
						value: "deep",
					},
				}),
		})
		.default({
			level1: {
				level2: {
					value: "deep",
				},
			},
		}),
});

describe("SettingsUIBuilder", () => {
	let container: HTMLElement;
	let settingsStore: SettingsStore<typeof TestSchema>;
	let uiBuilder: SettingsUIBuilder<typeof TestSchema>;

	beforeEach(() => {
		// Setup DOM environment
		document.body.innerHTML = "";
		container = document.createElement("div");

		// Helper to add Obsidian-specific methods to HTMLElements
		const addObsidianMethods = (el: HTMLElement) => {
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
		};

		addObsidianMethods(container);
		document.body.appendChild(container);

		// Create mock plugin
		const mockPlugin = {
			loadData: vi.fn().mockResolvedValue({}),
			saveData: vi.fn().mockResolvedValue(undefined),
		} as any;

		// Create settings store with test schema
		settingsStore = new SettingsStore(mockPlugin, TestSchema);

		// Create UI builder
		uiBuilder = new SettingsUIBuilder(settingsStore);
	});

	describe("addToggle", () => {
		it("should create a toggle with correct initial value", () => {
			uiBuilder.addToggle(container, {
				key: "enabled",
				name: "Enable Feature",
				desc: "Turn this feature on or off",
			});

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			expect(toggle).toBeDefined();
			expect(toggle.checked).toBe(false);
		});

		it("should update settings when toggle changes", async () => {
			uiBuilder.addToggle(container, {
				key: "enabled",
				name: "Enable Feature",
				desc: "Turn this feature on or off",
			});

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.enabled).toBe(true);
		});
	});

	describe("addSlider", () => {
		it("should create a slider with correct initial value and limits", () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider).toBeDefined();
			expect(slider.value).toBe("10");
			expect(slider.min).toBe("0");
			expect(slider.max).toBe("100");
			expect(slider.step).toBe("5");
		});

		it("should update settings when slider changes (commit on blur by default)", async () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			slider.value = "50";
			slider.dispatchEvent(new Event("mouseup"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(50);
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
				commitOnChange: true,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			slider.value = "50";
			slider.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(50);
		});

		it("should use default limits if not specified", () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider.min).toBe("0");
			expect(slider.max).toBe("100");
			expect(slider.step).toBe("1");
		});
	});

	describe("addSliderWithInput", () => {
		it("should create both a slider and a number input with correct initial values", () => {
			uiBuilder.addSliderWithInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;

			expect(slider).toBeDefined();
			expect(slider.value).toBe("10");
			expect(numberInput).toBeDefined();
			expect(numberInput.value).toBe("10");
			expect(numberInput.type).toBe("number");
			expect(numberInput.min).toBe("0");
			expect(numberInput.max).toBe("100");
			expect(numberInput.step).toBe("5");
		});

		it("should sync number input when slider changes", () => {
			uiBuilder.addSliderWithInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;

			slider.value = "75";
			slider.dispatchEvent(new Event("input"));

			expect(numberInput.value).toBe("75");
		});

		it("should update settings when number input blurs", async () => {
			uiBuilder.addSliderWithInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			numberInput.value = "42";
			numberInput.dispatchEvent(new Event("blur"));

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(42);
		});

		it("should clamp values to min/max bounds from number input", async () => {
			uiBuilder.addSliderWithInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			numberInput.value = "150";
			numberInput.dispatchEvent(new Event("blur"));

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(100);
			expect(numberInput.value).toBe("100");
		});

		it("should sync slider when number input commits", async () => {
			uiBuilder.addSliderWithInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;

			numberInput.value = "42";
			numberInput.dispatchEvent(new Event("blur"));

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(slider.value).toBe("42");
		});
	});

	describe("addNumberInput", () => {
		it("should create a number input with correct initial value and bounds", () => {
			uiBuilder.addNumberInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			expect(numberInput).toBeDefined();
			expect(numberInput.type).toBe("number");
			expect(numberInput.value).toBe("10");
			expect(numberInput.min).toBe("0");
			expect(numberInput.max).toBe("100");
			expect(numberInput.step).toBe("5");
		});

		it("should update settings when number input blurs", async () => {
			uiBuilder.addNumberInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			numberInput.value = "42";
			numberInput.dispatchEvent(new Event("blur"));

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(42);
		});

		it("should clamp values to min/max bounds", async () => {
			uiBuilder.addNumberInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
			});

			const numberInput = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			numberInput.value = "200";
			numberInput.dispatchEvent(new Event("blur"));

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(100);
			expect(numberInput.value).toBe("100");
		});

		it("should not render a slider element", () => {
			uiBuilder.addNumberInput(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
			});

			const slider = container.querySelector(".slider");
			expect(slider).toBeNull();
		});
	});

	describe("addText", () => {
		it("should create a text input with correct initial value", () => {
			// Set initial value
			void settingsStore.updateSettings((s) => ({ ...s, username: "testuser" }));

			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
				placeholder: "Enter username",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			expect(input).toBeDefined();
			expect(input.value).toBe("testuser");
			expect(input.placeholder).toBe("Enter username");
		});

		it("should update settings when text changes (commit on blur by default)", async () => {
			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "newuser";
			input.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.username).toBe("newuser");
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
				commitOnChange: true,
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "newuser";
			input.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.username).toBe("newuser");
		});
	});

	describe("addTextArray", () => {
		it("should create a text input for simple array", () => {
			void settingsStore.updateSettings((s) => ({ ...s, tags: ["tag1", "tag2"] }));

			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				arrayDelimiter: ", ",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			expect(input).toBeDefined();
			expect(input.value).toBe("tag1, tag2");
		});

		it("should create a textarea for multiline array", () => {
			void settingsStore.updateSettings((s) => ({ ...s, tags: ["tag1", "tag2", "tag3"] }));

			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				multiline: true,
			});

			const textarea = container.querySelector(".textarea-input") as HTMLTextAreaElement;
			expect(textarea).toBeDefined();
			expect(textarea.value).toBe("tag1\ntag2\ntag3");
		});

		it("should update settings when array text changes (commit on blur by default)", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "new1, new2, new3";
			input.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["new1", "new2", "new3"]);
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				commitOnChange: true,
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "new1, new2, new3";
			input.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["new1", "new2", "new3"]);
		});

		it("should handle multiline array updates on blur", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				multiline: true,
			});

			const textarea = container.querySelector(".textarea-input") as HTMLTextAreaElement;
			textarea.value = "line1\nline2\nline3";
			textarea.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["line1", "line2", "line3"]);
		});
	});

	describe("addArrayManager", () => {
		it("should render existing array items with remove buttons", () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const items = container.querySelectorAll(".settings-array-manager-list .setting-item-name");
			expect(items.length).toBe(2);
			expect(items[0].textContent).toBe("dir1");
			expect(items[1].textContent).toBe("dir2");

			const removeButtons = container.querySelectorAll(".settings-array-manager-list .button");
			expect(removeButtons.length).toBe(2);
		});

		it("should add new items when add button is clicked", async () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const input = container.querySelector("input[type='text']") as HTMLInputElement;
			const addButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Add"
			) as HTMLButtonElement;

			input.value = "dir2";
			addButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["dir1", "dir2"]);
		});

		it("should remove items when remove button is clicked", async () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const removeButtons = container.querySelectorAll(".settings-array-manager-list .button");
			const firstRemoveButton = removeButtons[0] as HTMLButtonElement;

			firstRemoveButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["dir2"]);
		});

		it("should prevent empty array when preventEmpty is true", async () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				preventEmpty: true,
				emptyArrayFallback: ["*"],
			});

			const removeButton = container.querySelector(".settings-array-manager-list .button") as HTMLButtonElement;
			removeButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["*"]);
		});

		it("should apply onBeforeAdd callback", async () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				onBeforeAdd: (newItem, currentItems) => {
					// Remove "*" when adding specific directory
					return [...currentItems.filter((i) => i !== "*"), newItem];
				},
			});

			// First set directories to include "*"
			await settingsStore.updateSettings((s) => ({ ...s, directories: ["*"] }));

			const input = container.querySelector("input[type='text']") as HTMLInputElement;
			const addButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Add"
			) as HTMLButtonElement;

			input.value = "specific-dir";
			addButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["specific-dir"]);
		});

		it("should render quick actions", () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			expect(resetButton).toBeDefined();
		});

		it("should execute quick actions", async () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			resetButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["*"]);
		});

		it("should respect quick action conditions", () => {
			void settingsStore.updateSettings((s) => ({ ...s, directories: ["*"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						condition: (items) => !items.includes("*"),
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			// Should not render because condition is false (already has "*")
			expect(resetButton).toBeUndefined();
		});
	});

	describe("Nested Keys Support", () => {
		let nestedContainer: HTMLElement;
		let nestedSettingsStore: SettingsStore<typeof NestedTestSchema>;
		let nestedUIBuilder: SettingsUIBuilder<typeof NestedTestSchema>;

		beforeEach(() => {
			// Setup DOM environment for nested tests
			document.body.innerHTML = "";
			nestedContainer = document.createElement("div");

			// Helper to add Obsidian-specific methods to HTMLElements
			const addObsidianMethods = (el: HTMLElement) => {
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
			};

			addObsidianMethods(nestedContainer);
			document.body.appendChild(nestedContainer);

			// Create mock plugin
			const mockPlugin = {
				loadData: vi.fn().mockResolvedValue({}),
				saveData: vi.fn().mockResolvedValue(undefined),
			} as any;

			// Create settings store with nested schema
			nestedSettingsStore = new SettingsStore(mockPlugin, NestedTestSchema);

			// Create UI builder
			nestedUIBuilder = new SettingsUIBuilder(nestedSettingsStore);
		});

		describe("addToggle with nested keys", () => {
			it("should read nested boolean value correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, enabled: true },
				}));

				// Create UI after settings are updated
				nestedUIBuilder.addToggle(nestedContainer, {
					key: "nested.enabled",
					name: "Nested Enabled",
					desc: "Toggle nested setting",
				});

				// Need to wait for next tick for DOM to update
				await new Promise((resolve) => setTimeout(resolve, 0));

				const toggle = nestedContainer.querySelector(".checkbox-toggle") as HTMLInputElement;
				expect(toggle).toBeDefined();
				expect(toggle.checked).toBe(true);
			});

			it("should update nested boolean value correctly", async () => {
				nestedUIBuilder.addToggle(nestedContainer, {
					key: "nested.enabled",
					name: "Nested Enabled",
					desc: "Toggle nested setting",
				});

				const toggle = nestedContainer.querySelector(".checkbox-toggle") as HTMLInputElement;
				toggle.checked = true;
				toggle.dispatchEvent(new Event("change"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.enabled).toBe(true);
			});

			it("should preserve other nested properties when updating", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, name: "preserved", count: 42 },
				}));

				nestedUIBuilder.addToggle(nestedContainer, {
					key: "nested.enabled",
					name: "Nested Enabled",
					desc: "Toggle nested setting",
				});

				const toggle = nestedContainer.querySelector(".checkbox-toggle") as HTMLInputElement;
				toggle.checked = true;
				toggle.dispatchEvent(new Event("change"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.enabled).toBe(true);
				expect(nestedSettingsStore.currentSettings.nested.name).toBe("preserved");
				expect(nestedSettingsStore.currentSettings.nested.count).toBe(42);
			});
		});

		describe("addSlider with nested keys", () => {
			it("should read nested number value correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, count: 75 },
				}));

				nestedUIBuilder.addSlider(nestedContainer, {
					key: "nested.count",
					name: "Nested Count",
					desc: "Slider for nested count",
					min: 0,
					max: 100,
				});

				const slider = nestedContainer.querySelector(".slider") as HTMLInputElement;
				expect(slider).toBeDefined();
				expect(slider.value).toBe("75");
			});

			it("should update nested number value correctly", async () => {
				nestedUIBuilder.addSlider(nestedContainer, {
					key: "nested.count",
					name: "Nested Count",
					desc: "Slider for nested count",
					min: 0,
					max: 100,
					commitOnChange: true,
				});

				const slider = nestedContainer.querySelector(".slider") as HTMLInputElement;
				slider.value = "85";
				slider.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.count).toBe(85);
			});

			it("should infer bounds from nested schema", () => {
				nestedUIBuilder.addSlider(nestedContainer, {
					key: "nested.count",
					name: "Nested Count",
					desc: "Slider for nested count",
				});

				const slider = nestedContainer.querySelector(".slider") as HTMLInputElement;
				expect(slider.min).toBe("0");
				expect(slider.max).toBe("100");
			});
		});

		describe("addText with nested keys", () => {
			it("should read nested string value correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, name: "test-name" },
				}));

				nestedUIBuilder.addText(nestedContainer, {
					key: "nested.name",
					name: "Nested Name",
					desc: "Text input for nested name",
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				expect(input).toBeDefined();
				expect(input.value).toBe("test-name");
			});

			it("should update nested string value correctly", async () => {
				nestedUIBuilder.addText(nestedContainer, {
					key: "nested.name",
					name: "Nested Name",
					desc: "Text input for nested name",
					commitOnChange: true,
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				input.value = "updated-name";
				input.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.name).toBe("updated-name");
			});
		});

		describe("addTextArray with nested keys", () => {
			it("should read nested array value correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, tags: ["tag1", "tag2", "tag3"] },
				}));

				nestedUIBuilder.addTextArray(nestedContainer, {
					key: "nested.tags",
					name: "Nested Tags",
					desc: "Array input for nested tags",
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				expect(input).toBeDefined();
				expect(input.value).toBe("tag1, tag2, tag3");
			});

			it("should update nested array value correctly", async () => {
				nestedUIBuilder.addTextArray(nestedContainer, {
					key: "nested.tags",
					name: "Nested Tags",
					desc: "Array input for nested tags",
					commitOnChange: true,
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				input.value = "new1, new2, new3";
				input.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.tags).toEqual(["new1", "new2", "new3"]);
			});

			it("should handle multiline nested arrays", async () => {
				nestedUIBuilder.addTextArray(nestedContainer, {
					key: "nested.tags",
					name: "Nested Tags",
					desc: "Array input for nested tags",
					multiline: true,
				});

				const textarea = nestedContainer.querySelector(".textarea-input") as HTMLTextAreaElement;
				textarea.value = "line1\nline2\nline3";
				textarea.dispatchEvent(new Event("blur"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.tags).toEqual(["line1", "line2", "line3"]);
			});
		});

		describe("addArrayManager with nested keys", () => {
			it("should render nested array items correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, items: ["item1", "item2"] },
				}));

				nestedUIBuilder.addArrayManager(nestedContainer, {
					key: "nested.items",
					name: "Nested Items",
					desc: "Manage nested items",
				});

				const items = nestedContainer.querySelectorAll(".settings-array-manager-list .setting-item-name");
				expect(items.length).toBe(2);
				expect(items[0].textContent).toBe("item1");
				expect(items[1].textContent).toBe("item2");
			});

			it("should add to nested array correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, items: ["item1"] },
				}));

				nestedUIBuilder.addArrayManager(nestedContainer, {
					key: "nested.items",
					name: "Nested Items",
					desc: "Manage nested items",
				});

				// Use document.getElementById since ID doesn't have special chars needing escaping
				const input = document.getElementById("settings-array-manager-input-nested.items") as HTMLInputElement;
				const addButton = Array.from(nestedContainer.querySelectorAll(".button")).find(
					(btn) => btn.textContent === "Add"
				) as HTMLButtonElement;

				expect(input).toBeDefined();
				input.value = "item2";
				addButton.click();

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.items).toEqual(["item1", "item2"]);
			});

			it("should remove from nested array correctly", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					nested: { ...s.nested, items: ["item1", "item2"] },
				}));

				nestedUIBuilder.addArrayManager(nestedContainer, {
					key: "nested.items",
					name: "Nested Items",
					desc: "Manage nested items",
				});

				const removeButtons = nestedContainer.querySelectorAll(".settings-array-manager-list .button");
				const firstRemoveButton = removeButtons[0] as HTMLButtonElement;

				firstRemoveButton.click();

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.items).toEqual(["item2"]);
			});
		});

		describe("Deeply nested keys", () => {
			it("should handle deeply nested string values", async () => {
				await nestedSettingsStore.updateSettings((s) => ({
					...s,
					deeplyNested: {
						level1: {
							level2: {
								value: "initial",
							},
						},
					},
				}));

				nestedUIBuilder.addText(nestedContainer, {
					key: "deeplyNested.level1.level2.value",
					name: "Deep Value",
					desc: "Deeply nested value",
					commitOnChange: true,
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				expect(input.value).toBe("initial");

				input.value = "updated";
				input.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.deeplyNested.level1.level2.value).toBe("updated");
			});
		});

		describe("Edge cases and validation", () => {
			it("should handle undefined nested values gracefully", () => {
				// Don't initialize the nested value
				nestedUIBuilder.addText(nestedContainer, {
					key: "nested.name",
					name: "Nested Name",
					desc: "Text input for nested name",
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				expect(input).toBeDefined();
				// Should use default value from schema
				expect(input.value).toBe("");
			});

			it("should validate nested updates against schema", async () => {
				nestedUIBuilder.addSlider(nestedContainer, {
					key: "nested.count",
					name: "Nested Count",
					desc: "Slider with validation",
					min: 0,
					max: 100,
				});

				const slider = nestedContainer.querySelector(".slider") as HTMLInputElement;

				// HTML sliders automatically clamp values to their min/max
				// So setting value="150" will be clamped to max="100"
				slider.value = "150";
				expect(slider.value).toBe("100"); // Clamped by browser

				slider.dispatchEvent(new Event("mouseup"));
				await new Promise((resolve) => setTimeout(resolve, 10));

				// Value should be updated to 100 (the clamped max)
				expect(nestedSettingsStore.currentSettings.nested.count).toBe(100);
			});

			it("should create missing intermediate objects when setting nested values", async () => {
				nestedUIBuilder.addText(nestedContainer, {
					key: "nested.name",
					name: "Nested Name",
					desc: "Text input for nested name",
					commitOnChange: true,
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				input.value = "new-value";
				input.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.nested.name).toBe("new-value");
				// Other nested properties should still have their default values
				expect(nestedSettingsStore.currentSettings.nested.enabled).toBe(false);
				expect(nestedSettingsStore.currentSettings.nested.count).toBe(10);
			});
		});

		describe("Backward compatibility with flat keys", () => {
			it("should still work with top-level flat keys", async () => {
				nestedUIBuilder.addText(nestedContainer, {
					key: "simple",
					name: "Simple",
					desc: "Flat key test",
					commitOnChange: true,
				});

				const input = nestedContainer.querySelector(".text-input") as HTMLInputElement;
				expect(input.value).toBe("test");

				input.value = "updated-simple";
				input.dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.simple).toBe("updated-simple");
			});

			it("should handle mix of flat and nested keys", async () => {
				nestedUIBuilder.addText(nestedContainer, {
					key: "simple",
					name: "Simple",
					desc: "Flat key",
					commitOnChange: true,
				});

				nestedUIBuilder.addText(nestedContainer, {
					key: "nested.name",
					name: "Nested Name",
					desc: "Nested key",
					commitOnChange: true,
				});

				const inputs = nestedContainer.querySelectorAll(".text-input") as NodeListOf<HTMLInputElement>;
				expect(inputs.length).toBe(2);

				// Update flat key
				inputs[0].value = "updated-flat";
				inputs[0].dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				// Update nested key
				inputs[1].value = "updated-nested";
				inputs[1].dispatchEvent(new Event("input"));

				await new Promise((resolve) => setTimeout(resolve, 0));

				expect(nestedSettingsStore.currentSettings.simple).toBe("updated-flat");
				expect(nestedSettingsStore.currentSettings.nested.name).toBe("updated-nested");
			});
		});
	});

	describe("addSchemaField", () => {
		it("renders a toggle for z.boolean()", () => {
			uiBuilder.addSchemaField(container, { enabled: z.boolean().catch(false).describe("Enable the feature") });

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			expect(toggle).toBeDefined();

			const desc = container.querySelector(".setting-item-description");
			expect(desc?.textContent).toBe("Enable the feature");

			const name = container.querySelector(".setting-item-name");
			expect(name?.textContent).toBe("Enabled");
		});

		it("renders a slider for z.number() with min/max", () => {
			uiBuilder.addSchemaField(container, {
				maxItems: z.number().min(1).max(10).catch(3).describe("Max events to stack"),
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider).toBeDefined();
			expect(slider.min).toBe("1");
			expect(slider.max).toBe("10");
		});

		it("renders a number input for z.number() without bounds", () => {
			uiBuilder.addSchemaField(container, { maxItems: z.number().catch(0).describe("Some count") });

			const input = container.querySelector(".settings-ui-builder-slider-input") as HTMLInputElement;
			expect(input).toBeDefined();
			expect(input.type).toBe("number");
		});

		it("renders a text input for z.string()", () => {
			uiBuilder.addSchemaField(container, { username: z.string().catch("").describe("Your username") });

			const input = container.querySelector(".text-input") as HTMLInputElement;
			expect(input).toBeDefined();
		});

		it("renders a dropdown for z.enum()", () => {
			uiBuilder.addSchemaField(container, {
				maxItems: z.enum(["small", "medium", "large"]).catch("medium").describe("Size option"),
			});

			const select = container.querySelector("select") as HTMLSelectElement;
			expect(select).toBeDefined();
			expect(select.options.length).toBe(3);
			expect(select.options[0].value).toBe("small");
			expect(select.options[0].text).toBe("Small");
		});

		it("uses .describe() as the setting description", () => {
			uiBuilder.addSchemaField(container, { enabled: z.boolean().describe("Toggle weekend visibility") });

			const desc = container.querySelector(".setting-item-description");
			expect(desc?.textContent).toBe("Toggle weekend visibility");
		});

		it("derives name from key via camelCaseToLabel", () => {
			uiBuilder.addSchemaField(container, { hideWeekends: z.boolean().catch(false) });

			const name = container.querySelector(".setting-item-name");
			expect(name?.textContent).toBe("Hide Weekends");
		});

		it("allows overriding the derived name", () => {
			uiBuilder.addSchemaField(container, { enabled: z.boolean().catch(false) }, { label: "Custom Name" });

			const name = container.querySelector(".setting-item-name");
			expect(name?.textContent).toBe("Custom Name");
		});

		it("allows overriding the description", () => {
			uiBuilder.addSchemaField(
				container,
				{ enabled: z.boolean().catch(false).describe("Schema desc") },
				{ desc: "Override desc" }
			);

			const desc = container.querySelector(".setting-item-description");
			expect(desc?.textContent).toBe("Override desc");
		});

		it("allows overriding enum options", () => {
			uiBuilder.addSchemaField(
				container,
				{ maxItems: z.enum(["a", "b"]).catch("a") },
				{ options: { a: "Alpha", b: "Bravo" } }
			);

			const select = container.querySelector("select") as HTMLSelectElement;
			expect(select.options[0].text).toBe("Alpha");
			expect(select.options[1].text).toBe("Bravo");
		});

		it("uses enumLabels from .meta() for dropdown labels", () => {
			uiBuilder.addSchemaField(container, {
				maxItems: z
					.enum(["left", "right"])
					.catch("left")
					.meta({ enumLabels: { left: "Left sidebar", right: "Right sidebar" } }),
			});

			const select = container.querySelector("select") as HTMLSelectElement;
			expect(select.options[0].text).toBe("Left sidebar");
			expect(select.options[1].text).toBe("Right sidebar");
		});

		it("applies step override for number fields", () => {
			uiBuilder.addSchemaField(container, { maxItems: z.number().min(0).max(100).catch(50) }, { step: 5 });

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider.step).toBe("5");
		});

		it("works with nested dot-notation keys via key override", () => {
			const nestedSchema = z.object({
				section: z.object({ flag: z.boolean().default(false) }).default({ flag: false }),
			});
			const mockPlugin = {
				loadData: vi.fn().mockResolvedValue({}),
				saveData: vi.fn().mockResolvedValue(undefined),
			} as any;
			const store = new SettingsStore(mockPlugin, nestedSchema);
			const builder = new SettingsUIBuilder(store);

			builder.addSchemaField(
				container,
				{ flag: z.boolean().catch(false).describe("A nested flag") },
				{ key: "section.flag" }
			);

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			expect(toggle).toBeDefined();

			const name = container.querySelector(".setting-item-name");
			expect(name?.textContent).toBe("Flag");
		});
	});
});
