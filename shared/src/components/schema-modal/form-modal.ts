import { Notice, Setting } from "obsidian";
import type { ZodRawShape } from "zod";

import { showModal } from "../component-renderer/modal";
import { renderSchemaForm } from "./form-renderer";
import { camelCaseToLabel } from "./introspect";
import { createModalButtons, registerSubmitHotkey } from "./modal-helpers";
import { injectSchemaFormStyles } from "./styles";
import type { SchemaFormModalConfig } from "./types";

function deriveTitleFromShape(shape: Record<string, unknown>): string {
	const firstKey = Object.keys(shape)[0];
	return firstKey ? camelCaseToLabel(firstKey) : "Form";
}

export function showSchemaFormModal<S extends ZodRawShape>(config: SchemaFormModalConfig<S>): void {
	injectSchemaFormStyles(config.prefix);

	const title = config.title ?? deriveTitleFromShape(config.shape);
	const baseCls = `${config.prefix}schema-form-modal`;
	const submitText = config.submitText ?? "Save";

	showModal({
		app: config.app,
		cls: baseCls,
		title,
		render: (el, ctx) => {
			if (config.cls && ctx.type === "modal") {
				ctx.modalEl.addClass(config.cls);
			}
			let nameRef: { value: string } | undefined;
			if (config.nameField) {
				nameRef = { value: "" };
				const placeholder = typeof config.nameField === "object" ? (config.nameField.placeholder ?? "Name") : "Name";
				new Setting(el).setName("Name").addText((text) => {
					text.setPlaceholder(placeholder).setValue("");
					text.onChange((v) => {
						if (nameRef) nameRef.value = v.trim();
					});
				});
			}

			const handle = renderSchemaForm(el, {
				shape: config.shape,
				prefix: config.prefix,
				mode: config.mode,
				fieldOverrides: config.fieldOverrides,
				existing: config.existing,
				extraFields: config.extraFields,
			});

			function submit(): void {
				if (nameRef && !nameRef.value) {
					new Notice("Name is required.");
					return;
				}

				const result = handle.validate();
				if (!result.success) {
					new Notice(`Validation failed: ${result.errors.join(", ")}`, 5000);
					return;
				}

				const submitResult = config.onSubmit(result.data);
				if (submitResult instanceof Promise) {
					void submitResult.then(() => ctx.close());
				} else {
					ctx.close();
				}
			}

			createModalButtons(el, {
				prefix: config.prefix,
				submitText,
				submitTestId: config.submitTestId,
				cancelTestId: config.cancelTestId,
				onSubmit: submit,
				onCancel: () => ctx.close(),
			});

			if (ctx.type === "modal") {
				registerSubmitHotkey(ctx.scope, submit);
			}
		},
	});
}
