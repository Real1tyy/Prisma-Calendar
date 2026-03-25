import { Notice, Setting } from "obsidian";

import type { ComponentContext } from "../component-renderer/types";
import { renderSchemaForm } from "./form-renderer";
import type { SchemaModalConfig, UpsertHandler } from "./types";

function renderNameField(el: HTMLElement, nameRef: { value: string }, config: SchemaModalConfig<unknown>): void {
	const placeholder = typeof config.nameField === "object" ? (config.nameField.placeholder ?? "Name") : "Name";

	new Setting(el).setName("Name").addText((text) => {
		text.setPlaceholder(placeholder).setValue(nameRef.value);
		text.onChange((v) => (nameRef.value = v.trim()));
	});
}

async function executeUpsert<T>(upsert: UpsertHandler<T>, isEdit: boolean, name: string, values: T): Promise<void> {
	try {
		if (isEdit) {
			await upsert.update(name, values);
			new Notice(`${upsert.entityName} "${name}" updated.`);
		} else {
			await upsert.create(name, values);
			new Notice(`${upsert.entityName} "${name}" created.`);
		}
	} catch (error) {
		new Notice(`Error: ${error}`);
	}
}

async function resolveSubmitAction<T>(config: SchemaModalConfig<T>, name: string, values: T): Promise<boolean> {
	if (config.upsert) {
		await executeUpsert(config.upsert, !!config.existing, name, values);
		return true;
	}
	const result = await config.onSubmit(name, values);
	return result !== false;
}

export function createSchemaFormRenderer<T>(config: SchemaModalConfig<T>) {
	const nameRef = { value: "" };

	return (el: HTMLElement, ctx: ComponentContext): void => {
		if (config.nameField && !config.existing) {
			renderNameField(el, nameRef, config as SchemaModalConfig<unknown>);
		}

		const handle = renderSchemaForm(el, {
			shape: config.shape,
			prefix: "",
			app: config.app,
			fieldOverrides: config.fieldOverrides,
			existing: config.existing?.data,
			extraFields: config.extraFields
				? (fieldEl, values, setValues) => config.extraFields!(fieldEl, values, ctx, setValues)
				: undefined,
		});

		new Setting(el)
			.addButton((btn) => {
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						if (config.nameField && !config.existing && !nameRef.value) {
							new Notice("Name is required.");
							return;
						}

						const result = handle.validate();
						if (!result.success) {
							new Notice(`Validation failed: ${result.errors.join(", ")}`, 5000);
							return;
						}

						const name = config.existing?.id ?? nameRef.value;
						void resolveSubmitAction(config, name, result.data as T).then((shouldClose) => {
							if (shouldClose) ctx.close();
						});
					});
			})
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => ctx.close());
			});
	};
}
