import { type App, Notice, SecretComponent, Setting } from "obsidian";
import type { z, ZodObject, ZodRawShape } from "zod";

import { camelCaseToLabel, introspectField } from "../../components/schema-modal/introspect";
import type { EnumFieldDescriptor, NumberFieldDescriptor } from "../../components/schema-modal/types";
import { getNestedValue, inferArrayItemType, inferSliderBounds, setNestedValue } from "./schema-navigation";
import type { SettingsStore } from "./settings-store";

interface BaseSettingConfig {
	key: string;
	name: string;
	desc: string;
	onChanged?: () => void;
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

interface ColorPickerSettingConfig extends BaseSettingConfig {
	fallback?: string;
}

interface OptionalColorPickerSettingConfig {
	key: string;
	name: string;
	descWhenSet: string;
	descWhenEmpty: string;
	fallback?: string;
}

export interface SchemaFieldOverrides {
	key?: string;
	label?: string;
	desc?: string;
	step?: number;
	commitOnChange?: boolean;
	placeholder?: string;
	options?: Record<string, string>;
	onChanged?: () => void;
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
	constructor(
		private settingsStore: SettingsStore<TSchema>,
		private app?: App
	) {}

	private get settings(): z.infer<TSchema> {
		return this.settingsStore.currentSettings;
	}

	private get schema(): TSchema {
		return this.settingsStore.validationSchema;
	}

	private getNestedValue(key: string): unknown {
		return getNestedValue(this.settings as Record<string, unknown>, key);
	}

	private setNestedValue(key: string, value: unknown): z.infer<TSchema> {
		return setNestedValue(this.settings as Record<string, unknown>, key, value) as z.infer<TSchema>;
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

		await this.settingsStore.updateSettings(() => result.data as z.infer<TSchema>);
	}

	private inferSliderBounds(key: string): { min?: number; max?: number } {
		return inferSliderBounds(this.schema.shape, key);
	}

	private inferArrayItemType(key: string): "string" | "number" | undefined {
		return inferArrayItemType(this.schema.shape, key);
	}

	addToggle(containerEl: HTMLElement, config: BaseSettingConfig): void {
		const { key, name, desc, onChanged } = config;
		const value = this.getNestedValue(key);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(Boolean(value)).onChange(async (newValue) => {
					await this.updateSetting(key, newValue);
					onChanged?.();
				})
			);
	}

	addSecret(containerEl: HTMLElement, config: BaseSettingConfig): void {
		if (!this.app)
			throw new Error("SettingsUIBuilder: app is required for addSecret. Pass it as the second constructor argument.");

		const { key, name, desc, onChanged } = config;
		const value = this.getNestedValue(key);
		const app = this.app;

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addComponent((el) =>
				new SecretComponent(app, el).setValue(String(value ?? "")).onChange(async (newValue) => {
					await this.updateSetting(key, newValue);
					onChanged?.();
				})
			);
	}

	/**
	 * Renders a pair of mutually exclusive toggles.
	 * Enabling one automatically disables the other.
	 * Requires a rerender callback to refresh UI state after toggling.
	 */
	addMutuallyExclusiveToggles(
		containerEl: HTMLElement,
		config: {
			toggleA: BaseSettingConfig;
			toggleB: BaseSettingConfig;
		},
		rerender: () => void
	): void {
		const { toggleA, toggleB } = config;

		const renderToggle = (thisToggle: BaseSettingConfig, otherKey: string): void => {
			new Setting(containerEl)
				.setName(thisToggle.name)
				.setDesc(thisToggle.desc)
				.addToggle((toggle) =>
					toggle.setValue(Boolean(this.getNestedValue(thisToggle.key))).onChange(async (value) => {
						let newSettings = this.setNestedValue(thisToggle.key, value);
						if (value) {
							newSettings = setNestedValue(newSettings as Record<string, unknown>, otherKey, false) as z.infer<TSchema>;
						}
						await this.settingsStore.updateSettings(() => newSettings);
						rerender();
					})
				);
		};

		renderToggle(toggleA, toggleB.key);
		renderToggle(toggleB, toggleA.key);
	}

	private resolveSliderConfig(config: SliderSettingConfig): {
		value: number;
		min: number;
		max: number;
		step: number;
	} {
		const inferredBounds = this.inferSliderBounds(config.key);
		return {
			value: Number(this.getNestedValue(config.key)),
			min: config.min ?? inferredBounds.min ?? 0,
			max: config.max ?? inferredBounds.max ?? 100,
			step: config.step ?? 1,
		};
	}

	private attachDeferredSliderCommit(sliderEl: HTMLInputElement, commit: (value: number) => Promise<unknown>): void {
		sliderEl.addEventListener("mouseup", () => {
			void commit(Number(sliderEl.value));
		});

		sliderEl.addEventListener("keyup", (e: KeyboardEvent) => {
			if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
				void commit(Number(sliderEl.value));
			}
		});
	}

	private createNumberInput(
		parentEl: HTMLElement,
		bounds: { value: number; min: number; max: number; step: number },
		commit: (value: number) => Promise<number>
	): HTMLInputElement {
		const inputEl = parentEl.createEl("input", {
			type: "number",
			cls: "settings-ui-builder-slider-input",
			value: String(bounds.value),
		});
		inputEl.min = String(bounds.min);
		inputEl.max = String(bounds.max);
		inputEl.step = String(bounds.step);

		const commitFromInput = async () => {
			const parsed = Number(inputEl.value);
			if (Number.isNaN(parsed)) return;
			const clamped = await commit(parsed);
			inputEl.value = String(clamped);
		};

		inputEl.addEventListener("blur", () => void commitFromInput());
		inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void commitFromInput();
			}
		});

		return inputEl;
	}

	addSlider(containerEl: HTMLElement, config: SliderSettingConfig): void {
		const { key, name, desc, commitOnChange = false, onChanged } = config;
		const { value, min, max, step } = this.resolveSliderConfig(config);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => {
				slider.setLimits(min, max, step).setValue(value).setDynamicTooltip();

				if (commitOnChange) {
					slider.onChange(async (newValue) => {
						await this.updateSetting(key, newValue);
						onChanged?.();
					});
				} else {
					const commit = async (newValue: number) => {
						try {
							await this.updateSetting(key, newValue);
							onChanged?.();
						} catch (error) {
							new Notice(`Invalid input: ${error}`, 5000);
						}
					};

					slider.onChange((newValue) => {
						slider.sliderEl.setAttribute("aria-valuenow", String(newValue));
					});

					this.attachDeferredSliderCommit(slider.sliderEl, commit);
				}

				return slider;
			});
	}

	addSliderWithInput(containerEl: HTMLElement, config: SliderSettingConfig): void {
		const { key, name, desc, onChanged } = config;
		const { value, min, max, step } = this.resolveSliderConfig(config);

		const setting = new Setting(containerEl).setName(name).setDesc(desc);

		let sliderInputEl: HTMLInputElement | null = null;
		let numberInputEl: HTMLInputElement | null = null;

		const commit = async (newValue: number) => {
			const clamped = Math.min(max, Math.max(min, newValue));
			try {
				await this.updateSetting(key, clamped);
				onChanged?.();
			} catch (error) {
				new Notice(`Invalid input: ${error}`, 5000);
			}
			return clamped;
		};

		setting.addSlider((slider) => {
			sliderInputEl = slider.sliderEl;
			slider.setLimits(min, max, step).setValue(value).setDynamicTooltip();

			slider.onChange((newValue) => {
				sliderInputEl!.setAttribute("aria-valuenow", String(newValue));
				if (numberInputEl) numberInputEl.value = String(newValue);
			});

			this.attachDeferredSliderCommit(sliderInputEl, commit);

			return slider;
		});

		numberInputEl = this.createNumberInput(setting.controlEl, { value, min, max, step }, async (v) => {
			const clamped = await commit(v);
			if (sliderInputEl) sliderInputEl.value = String(clamped);
			return clamped;
		});
	}

	addNumberInput(containerEl: HTMLElement, config: SliderSettingConfig): void {
		const { key, name, desc, onChanged } = config;
		const { value, min, max, step } = this.resolveSliderConfig(config);

		const setting = new Setting(containerEl).setName(name).setDesc(desc);

		this.createNumberInput(setting.controlEl, { value, min, max, step }, async (newValue) => {
			const clamped = Math.min(max, Math.max(min, newValue));
			try {
				await this.updateSetting(key, clamped);
				onChanged?.();
			} catch (error) {
				new Notice(`Invalid input: ${error}`, 5000);
			}
			return clamped;
		});
	}

	addText(containerEl: HTMLElement, config: TextSettingConfig): void {
		const { key, name, desc, placeholder = "", commitOnChange = false, onChanged } = config;
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
						onChanged?.();
					});
				} else {
					// Commit only on blur or Ctrl/Cmd+Enter
					const commit = async (inputValue: string) => {
						try {
							await this.updateSetting(key, inputValue);
							onChanged?.();
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
		const { key, name, desc, options, onChanged } = config;
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
						onChanged?.();
					})
			);
	}

	addColorPicker(containerEl: HTMLElement, config: ColorPickerSettingConfig): void {
		const { key, name, desc, fallback, onChanged } = config;
		const value = this.getNestedValue(key);

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addColorPicker((colorPicker) =>
				colorPicker.setValue(String(value ?? fallback ?? "#000000")).onChange(async (newValue) => {
					await this.updateSetting(key, newValue || fallback || "#000000");
					onChanged?.();
				})
			);
	}

	addOptionalColorPicker(containerEl: HTMLElement, config: OptionalColorPickerSettingConfig): void {
		const { key, name, descWhenSet, descWhenEmpty, fallback = "#000000" } = config;
		const wrapper = containerEl.createDiv();

		const render = (): void => {
			wrapper.empty();
			const color = String(this.getNestedValue(key) ?? "");

			const setting = new Setting(wrapper).setName(name).addColorPicker((picker) => {
				picker.setValue(color || fallback).onChange(async (value) => {
					await this.updateSetting(key, value);
					render();
				});
			});

			if (color) {
				setting.setDesc(descWhenSet);
				setting.addButton((button) => {
					button.setButtonText("Clear").onClick(async () => {
						await this.updateSetting(key, "");
						render();
					});
				});
			} else {
				setting.setDesc(descWhenEmpty);
			}
		};

		render();
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
			onChanged,
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
						onChanged?.();
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
						onChanged?.();
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

	addSchemaField(
		containerEl: HTMLElement,
		fieldEntry: Record<string, z.ZodType>,
		overrides?: SchemaFieldOverrides
	): void {
		const [entryKey, field] = Object.entries(fieldEntry)[0];
		const settingsKey = overrides?.key ?? entryKey;
		const fieldKey = settingsKey.includes(".") ? settingsKey.split(".").pop()! : settingsKey;
		const descriptor = introspectField(fieldKey, field);

		const name = overrides?.label ?? descriptor.label;
		const desc = overrides?.desc ?? descriptor.description ?? "";
		const baseConfig = {
			key: settingsKey,
			name,
			desc,
			...(overrides?.onChanged !== undefined ? { onChanged: overrides.onChanged } : {}),
		};

		switch (descriptor.type) {
			case "boolean":
			case "toggle":
				this.addToggle(containerEl, baseConfig);
				break;
			case "number":
				this.renderSchemaNumber(containerEl, descriptor, baseConfig, overrides);
				break;
			case "enum":
				this.renderSchemaEnum(containerEl, descriptor, baseConfig, overrides);
				break;
			case "string":
				this.addText(containerEl, {
					...baseConfig,
					placeholder: overrides?.placeholder ?? descriptor.placeholder ?? "",
					...(overrides?.commitOnChange !== undefined ? { commitOnChange: overrides.commitOnChange } : {}),
				});
				break;
			case "array":
				this.addTextArray(containerEl, {
					...baseConfig,
					...(overrides?.placeholder !== undefined ? { placeholder: overrides.placeholder } : {}),
					itemType: descriptor.itemType,
				});
				break;
			case "date":
			case "datetime":
				this.addText(containerEl, {
					...baseConfig,
					placeholder: overrides?.placeholder ?? (descriptor.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm"),
				});
				break;
		}
	}

	private renderSchemaNumber(
		containerEl: HTMLElement,
		descriptor: NumberFieldDescriptor,
		baseConfig: BaseSettingConfig,
		overrides?: SchemaFieldOverrides
	): void {
		const { min, max } = descriptor;
		if (min !== undefined && max !== undefined) {
			this.addSlider(containerEl, {
				...baseConfig,
				min,
				max,
				...(overrides?.step !== undefined ? { step: overrides.step } : {}),
				...(overrides?.commitOnChange !== undefined ? { commitOnChange: overrides.commitOnChange } : {}),
			});
		} else {
			this.addNumberInput(containerEl, {
				...baseConfig,
				...(min !== undefined ? { min } : {}),
				...(max !== undefined ? { max } : {}),
				...(overrides?.step !== undefined ? { step: overrides.step } : {}),
			});
		}
	}

	private renderSchemaEnum(
		containerEl: HTMLElement,
		descriptor: EnumFieldDescriptor,
		baseConfig: BaseSettingConfig,
		overrides?: SchemaFieldOverrides
	): void {
		const options =
			overrides?.options ??
			descriptor.enumLabels ??
			Object.fromEntries(descriptor.enumValues.map((v) => [v, camelCaseToLabel(v)]));
		this.addDropdown(containerEl, { ...baseConfig, options });
	}
}
