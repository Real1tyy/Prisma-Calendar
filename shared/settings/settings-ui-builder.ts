import { Notice, Setting } from "obsidian";
import type { ZodArray, ZodNumber, ZodObject, ZodRawShape, z } from "zod";
import type { SettingsStore } from "./settings-store";

interface BaseSettingConfig {
	key: string;
	name: string;
	desc: string;
}

interface TextSettingConfig extends BaseSettingConfig {
	placeholder?: string;
	commitOnChange?: boolean;
}

interface SliderSettingConfig extends BaseSettingConfig {
	min?: number;
	max?: number;
	step?: number;
	commitOnChange?: boolean;
}

interface DropdownSettingConfig extends BaseSettingConfig {
	options: Record<string, string>;
}

interface ArraySettingConfig<T = string> extends BaseSettingConfig {
	placeholder?: string;
	arrayDelimiter?: string;
	multiline?: boolean;
	commitOnChange?: boolean;
	itemType?: "string" | "number";
	parser?: (input: string) => T;
	validator?: (item: T) => boolean;
}

interface ArrayManagerConfig extends BaseSettingConfig {
	placeholder?: string;
	addButtonText?: string;
	removeButtonText?: string;
	emptyArrayFallback?: unknown;
	preventEmpty?: boolean;
	itemDescriptionFn?: (item: unknown) => string;
	onBeforeAdd?: (newItem: unknown, currentItems: unknown[]) => unknown[] | Promise<unknown[]>;
	onBeforeRemove?: (itemToRemove: unknown, currentItems: unknown[]) => unknown[] | Promise<unknown[]>;
	quickActions?: Array<{
		name: string;
		desc: string;
		buttonText: string;
		condition?: (currentItems: unknown[]) => boolean;
		action: (currentItems: unknown[]) => unknown[] | Promise<unknown[]>;
	}>;
}

export class SettingsUIBuilder<TSchema extends ZodObject<ZodRawShape>> {
	constructor(private settingsStore: SettingsStore<TSchema>) {}

	private get settings(): z.infer<TSchema> {
		return this.settingsStore.currentSettings;
	}

	private get schema(): TSchema {
		return this.settingsStore.validationSchema;
	}

	/**
	 * Gets a nested property value using dot notation (e.g., "basesView.tasksDirectory")
	 */
	private getNestedValue(key: string): unknown {
		const keys = key.split(".");
		let value: any = this.settings;

		for (const k of keys) {
			if (value === undefined || value === null) {
				return undefined;
			}
			value = (value as Record<string, any>)[k];
		}

		return value;
	}

	/**
	 * Sets a nested property value using dot notation and returns updated settings
	 */
	private setNestedValue(key: string, value: unknown): z.infer<TSchema> {
		const keys = key.split(".");
		const newSettings = JSON.parse(JSON.stringify(this.settings)) as Record<string, any>; // Deep clone

		let current: Record<string, any> = newSettings;

		// Navigate to the parent of the target property
		for (let i = 0; i < keys.length - 1; i++) {
			const k = keys[i];
			if (!(k in current)) {
				current[k] = {};
			}
			current = current[k] as Record<string, any>;
		}

		// Set the final property
		const lastKey = keys[keys.length - 1];
		current[lastKey] = value;

		return newSettings as z.infer<TSchema>;
	}

	private async updateSetting(key: string, value: unknown): Promise<void> {
		const newSettings = this.setNestedValue(key, value);

		const result = this.schema.safeParse(newSettings);

		if (!result.success) {
			const errors = result.error.issues
				.map((e) => `${String(e.path.join("."))}${e.path.length > 0 ? ": " : ""}${e.message}`)
				.join(", ");
			new Notice(`Validation failed: ${errors}`, 5000);
			throw new Error(`Validation failed: ${errors}`);
		}

		await this.settingsStore.updateSettings(() => newSettings);
	}

	private inferSliderBounds(key: string): { min?: number; max?: number; step?: number } {
		try {
			// Navigate nested schema using dot notation
			const keys = key.split(".");
			let fieldSchema: any = this.schema.shape;

			for (const k of keys) {
				if (!fieldSchema) return {};

				// Unwrap nested schemas

				while (
					fieldSchema &&
					typeof fieldSchema === "object" &&
					"_def" in fieldSchema &&
					(fieldSchema as any)._def?.innerType
				) {
					fieldSchema = (fieldSchema as any)._def.innerType;
				}

				if (fieldSchema && typeof fieldSchema === "object" && "shape" in fieldSchema) {
					fieldSchema = (fieldSchema as any).shape?.[k];
				} else if (fieldSchema && typeof fieldSchema === "object" && k in fieldSchema) {
					fieldSchema = (fieldSchema as any)[k];
				} else {
					return {};
				}
			}

			if (!fieldSchema) return {};

			let innerSchema: any = fieldSchema;

			while (
				innerSchema &&
				typeof innerSchema === "object" &&
				"_def" in innerSchema &&
				(innerSchema as any)._def?.innerType
			) {
				innerSchema = (innerSchema as any)._def.innerType;
			}

			if (
				innerSchema &&
				typeof innerSchema === "object" &&
				"_def" in innerSchema &&
				(innerSchema as any)._def?.typeName === "ZodNumber"
			) {
				const checks = ((innerSchema as ZodNumber)._def as any).checks || [];
				let min: number | undefined;
				let max: number | undefined;

				for (const check of checks) {
					if ((check as any).kind === "min") {
						min = (check as any).value;
					}

					if ((check as any).kind === "max") {
						max = (check as any).value;
					}
				}

				return { min, max };
			}
		} catch (error) {
			console.warn(`Failed to infer slider bounds for key ${key}:`, error);
		}

		return {};
	}

	private inferArrayItemType(key: string): "string" | "number" | undefined {
		try {
			// Navigate nested schema using dot notation
			const keys = key.split(".");

			let fieldSchema: any = this.schema.shape;

			for (const k of keys) {
				if (!fieldSchema) return undefined;

				// Unwrap nested schemas

				while (
					fieldSchema &&
					typeof fieldSchema === "object" &&
					"_def" in fieldSchema &&
					(fieldSchema as any)._def?.innerType
				) {
					fieldSchema = (fieldSchema as any)._def.innerType;
				}

				if (fieldSchema && typeof fieldSchema === "object" && "shape" in fieldSchema) {
					fieldSchema = (fieldSchema as any).shape?.[k];
				} else if (fieldSchema && typeof fieldSchema === "object" && k in fieldSchema) {
					fieldSchema = (fieldSchema as any)[k];
				} else {
					return undefined;
				}
			}

			if (!fieldSchema) return undefined;

			let innerSchema: any = fieldSchema;

			while (
				innerSchema &&
				typeof innerSchema === "object" &&
				"_def" in innerSchema &&
				(innerSchema as any)._def?.innerType
			) {
				innerSchema = (innerSchema as any)._def.innerType;
			}

			if (
				innerSchema &&
				typeof innerSchema === "object" &&
				"_def" in innerSchema &&
				(innerSchema as any)._def?.typeName === "ZodArray"
			) {
				const elementType = ((innerSchema as ZodArray<any>)._def as any).type;

				if (elementType && (elementType as any)._def?.typeName === "ZodNumber") {
					return "number";
				}

				if (elementType && (elementType as any)._def?.typeName === "ZodString") {
					return "string";
				}
			}
		} catch (error) {
			console.warn(`Failed to infer array item type for key ${key}:`, error);
		}

		return undefined;
	}

	addToggle(containerEl: HTMLElement, config: BaseSettingConfig): void {
		const { key, name, desc } = config;
		const value = this.getNestedValue(key);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(Boolean(value)).onChange(async (newValue) => {
					await this.updateSetting(key, newValue);
				})
			);
	}

	addSlider(containerEl: HTMLElement, config: SliderSettingConfig): void {
		const { key, name, desc, step = 1, commitOnChange = false } = config;
		const value = this.getNestedValue(key);

		const inferredBounds = this.inferSliderBounds(key);
		const min = config.min ?? inferredBounds.min ?? 0;
		const max = config.max ?? inferredBounds.max ?? 100;

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => {
				slider.setLimits(min, max, step).setValue(Number(value)).setDynamicTooltip();

				if (commitOnChange) {
					// Reactive: commit on every change
					slider.onChange(async (newValue) => {
						await this.updateSetting(key, newValue);
					});
				} else {
					// Commit only when user finishes dragging
					const commit = async (newValue: number) => {
						try {
							await this.updateSetting(key, newValue);
						} catch (error) {
							new Notice(`Invalid input: ${error}`, 5000);
						}
					};

					// Update tooltip during drag for visual feedback
					slider.onChange((newValue) => {
						slider.sliderEl.setAttribute("aria-valuenow", String(newValue));
					});

					// Commit on mouse up
					slider.sliderEl.addEventListener("mouseup", () => {
						void commit(Number(slider.sliderEl.value));
					});

					// Commit on keyboard navigation
					slider.sliderEl.addEventListener("keyup", (e: KeyboardEvent) => {
						if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
							void commit(Number(slider.sliderEl.value));
						}
					});
				}

				return slider;
			});
	}

	addText(containerEl: HTMLElement, config: TextSettingConfig): void {
		const { key, name, desc, placeholder = "", commitOnChange = false } = config;
		const value = this.getNestedValue(key);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(String(value ?? ""));

				if (commitOnChange) {
					// Reactive: commit on every change
					text.onChange(async (newValue) => {
						await this.updateSetting(key, newValue);
					});
				} else {
					// Commit only on blur or Ctrl/Cmd+Enter
					const commit = async (inputValue: string) => {
						try {
							await this.updateSetting(key, inputValue);
						} catch (error) {
							new Notice(`Invalid input: ${error}`, 5000);
						}
					};

					text.inputEl.addEventListener("blur", () => void commit(text.inputEl.value));
					text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
							e.preventDefault();
							void commit(text.inputEl.value);
						}
					});
				}
			});
	}

	addDropdown(containerEl: HTMLElement, config: DropdownSettingConfig): void {
		const { key, name, desc, options } = config;
		const value = this.getNestedValue(key);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(options)
					.setValue(String(value))
					.onChange(async (newValue) => {
						await this.updateSetting(key, newValue);
					})
			);
	}

	addTextArray<T = string>(containerEl: HTMLElement, config: ArraySettingConfig<T>): void {
		const {
			key,
			name,
			desc,
			placeholder = "",
			arrayDelimiter = ", ",
			multiline = false,
			commitOnChange = false,
		} = config;
		const value = this.getNestedValue(key) as T[];

		const inferredItemType = config.itemType ?? this.inferArrayItemType(key) ?? "string";
		const parser =
			config.parser ??
			((input: string) => {
				if (inferredItemType === "number") {
					const num = Number(input);
					if (Number.isNaN(num)) {
						throw new Error(`Invalid number: ${input}`);
					}
					return num as T;
				}
				return input as T;
			});

		const validator = config.validator ?? ((_item: T) => true);

		const setting = new Setting(containerEl).setName(name).setDesc(desc);

		if (multiline) {
			setting.addTextArea((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(Array.isArray(value) ? value.join("\n") : "");

				const commit = async (inputValue: string) => {
					const lines = inputValue
						.split("\n")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);

					try {
						const items = lines.map(parser).filter(validator);
						await this.updateSetting(key, items);
					} catch (error) {
						new Notice(`Invalid input: ${error}`, 5000);
					}
				};

				if (commitOnChange) {
					// Reactive: commit on every change
					text.onChange(async (inputValue) => {
						await commit(inputValue);
					});
				} else {
					// Commit only on blur or Ctrl/Cmd+Enter
					text.inputEl.addEventListener("blur", () => void commit(text.inputEl.value));
					text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
							e.preventDefault();
							void commit(text.inputEl.value);
						}
					});
				}

				text.inputEl.rows = 5;
				text.inputEl.classList.add("settings-ui-builder-textarea");
			});
		} else {
			setting.addText((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(Array.isArray(value) ? value.join(arrayDelimiter) : "");

				const commit = async (inputValue: string) => {
					const tokens = inputValue
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);

					try {
						const items = tokens.map(parser).filter(validator);
						await this.updateSetting(key, items);
					} catch (error) {
						new Notice(`Invalid input: ${error}`, 5000);
					}
				};

				if (commitOnChange) {
					// Reactive: commit on every change
					text.onChange(async (inputValue) => {
						await commit(inputValue);
					});
				} else {
					// Commit only on blur or Ctrl/Cmd+Enter
					text.inputEl.addEventListener("blur", () => void commit(text.inputEl.value));
					text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
							e.preventDefault();
							void commit(text.inputEl.value);
						}
					});
				}
			});
		}
	}

	/**
	 * Advanced array manager with add/remove buttons for each item
	 */
	addArrayManager(containerEl: HTMLElement, config: ArrayManagerConfig): void {
		const {
			key,
			name,
			desc,
			placeholder = "",
			addButtonText = "Add",
			removeButtonText = "Remove",
			emptyArrayFallback = [],
			preventEmpty = false,
			itemDescriptionFn,
			onBeforeAdd,
			onBeforeRemove,
			quickActions = [],
		} = config;

		// Section heading
		new Setting(containerEl).setName(name).setHeading();

		// Description
		if (desc) {
			const descEl = containerEl.createDiv("setting-item-description");
			descEl.setText(desc);
		}

		// Container for list items
		const listContainer = containerEl.createDiv("settings-array-manager-list");

		const render = () => {
			listContainer.empty();

			const currentItems = (this.getNestedValue(key) as unknown[]) ?? [];

			for (const item of currentItems) {
				const itemSetting = new Setting(listContainer).setName(String(item)).addButton((button) =>
					button
						.setButtonText(removeButtonText)
						.setWarning()
						.onClick(async () => {
							let newItems = currentItems.filter((i) => i !== item);

							// Apply custom logic before removal
							if (onBeforeRemove) {
								newItems = await onBeforeRemove(item, currentItems);
							}

							// Prevent empty array if configured
							if (preventEmpty && newItems.length === 0) {
								newItems = Array.isArray(emptyArrayFallback) ? emptyArrayFallback : [emptyArrayFallback];
							}

							await this.updateSetting(key, newItems);
							render();
						})
				);

				// Add custom description for each item if provided
				if (itemDescriptionFn) {
					itemSetting.setDesc(itemDescriptionFn(item));
				}
			}
		};

		render();

		// Add new item section
		const inputId = `settings-array-manager-input-${key}`;
		new Setting(containerEl)
			.setName(`Add ${name.toLowerCase()}`)
			.setDesc(`Enter a new value`)
			.addText((text) => {
				text.setPlaceholder(placeholder);
				text.inputEl.id = inputId;
			})
			.addButton((button) =>
				button
					.setButtonText(addButtonText)
					.setCta()
					.onClick(async () => {
						const input = document.getElementById(inputId) as HTMLInputElement;
						if (!input) {
							console.error(`Input element not found: ${inputId}`);
							return;
						}

						const newItem = input.value.trim();

						if (!newItem) {
							return;
						}

						const currentItems = (this.getNestedValue(key) as unknown[]) ?? [];
						let newItems = [...currentItems];

						// Apply custom logic before adding
						if (onBeforeAdd) {
							newItems = await onBeforeAdd(newItem, currentItems);
						} else {
							// Default behavior: add if not exists
							if (!newItems.includes(newItem)) {
								newItems.push(newItem);
							}
						}

						await this.updateSetting(key, newItems);
						input.value = "";
						render();
					})
			);

		// Quick actions
		for (const quickAction of quickActions) {
			const currentItems = (this.getNestedValue(key) as unknown[]) ?? [];

			// Check condition if provided
			if (quickAction.condition && !quickAction.condition(currentItems)) {
				continue;
			}

			new Setting(containerEl)
				.setName(quickAction.name)
				.setDesc(quickAction.desc)
				.addButton((button) =>
					button.setButtonText(quickAction.buttonText).onClick(async () => {
						const currentItems = (this.getNestedValue(key) as unknown[]) ?? [];
						const newItems = await quickAction.action(currentItems);
						await this.updateSetting(key, newItems);
						render();
					})
				);
		}
	}
}
