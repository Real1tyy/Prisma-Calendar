import { cls } from "@real1ty-obsidian-plugins";

interface FormFieldConfig {
	label: string;
	type: string;
	placeholder?: string;
	description?: string;
	attrs?: Record<string, string>;
}

/**
 * Creates a standard setting-item form field with label, optional description, and input element.
 * Used across the event modal for simple fields (location, icon, participants, break, etc.).
 */
export function createFormField(parent: HTMLElement, config: FormFieldConfig): HTMLInputElement {
	const container = parent.createDiv(cls("setting-item"));
	container.createEl("div", { text: config.label, cls: cls("setting-item-name") });

	if (config.description) {
		container.createEl("div", { cls: cls("setting-item-description") }).setText(config.description);
	}

	return container.createEl("input", {
		type: config.type,
		cls: cls("setting-item-control"),
		attr: {
			...(config.placeholder ? { placeholder: config.placeholder } : {}),
			...config.attrs,
		},
	});
}
