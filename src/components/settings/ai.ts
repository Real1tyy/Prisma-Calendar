import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import type { PrismaCalendarSettingsStore } from "../../types";
import { AI_DEFAULTS } from "../../types/ai";
import { CustomCalendarSettingsSchema, type CustomPrompt } from "../../types/settings";

const AIShape = CustomCalendarSettingsSchema.shape.ai.unwrap().shape;

export class AISettings {
	private ui: SettingsUIBuilder<typeof CustomCalendarSettingsSchema>;

	constructor(
		private plugin: CustomCalendarPlugin,
		private mainSettingsStore: PrismaCalendarSettingsStore
	) {
		this.ui = new SettingsUIBuilder(this.mainSettingsStore as never, this.plugin.app);
	}

	display(containerEl: HTMLElement): void {
		this.addAPISettings(containerEl);
		this.addManipulationSettings(containerEl);
		this.addPlanningSettings(containerEl);
		this.addCustomPromptsSection(containerEl);
	}

	private addAPISettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("AI Assistant").setHeading();

		this.ui.addSecret(containerEl, {
			key: "ai.anthropicApiKeySecretName",
			name: "Anthropic API key",
			desc: "Select an Anthropic API key from SecretStorage for Claude models. Secrets are stored securely by Obsidian.",
		});

		this.ui.addSecret(containerEl, {
			key: "ai.openaiApiKeySecretName",
			name: "OpenAI API key",
			desc: "Select an OpenAI API key from SecretStorage for GPT models. Secrets are stored securely by Obsidian.",
		});

		this.ui.addDropdown(containerEl, {
			key: "ai.aiModel",
			name: "Model",
			desc: "Which AI model to use for the chat assistant. Requires the corresponding API key.",
			options: Object.fromEntries(Object.entries(AI_DEFAULTS.MODEL_OPTIONS).map(([k, v]) => [k, v.label])),
		});
	}

	private addManipulationSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Event Manipulation").setHeading();

		this.ui.addSchemaField(
			containerEl,
			{ aiBatchExecution: AIShape.aiBatchExecution },
			{ key: "ai.aiBatchExecution", label: "Batch execution" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ aiConfirmExecution: AIShape.aiConfirmExecution },
			{ key: "ai.aiConfirmExecution", label: "Confirm before execution" }
		);
	}

	private addPlanningSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Planning").setHeading();

		this.ui.addSchemaField(
			containerEl,
			{ aiPlanningGapDetection: AIShape.aiPlanningGapDetection },
			{ key: "ai.aiPlanningGapDetection", label: "Gap detection" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ aiPlanningDayCoverage: AIShape.aiPlanningDayCoverage },
			{ key: "ai.aiPlanningDayCoverage", label: "Day coverage" }
		);
	}

	private addCustomPromptsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Custom Prompts").setHeading();

		const desc = containerEl.createEl("p", {
			cls: cls("hint"),
			text: "Define reusable context snippets that get prepended to your AI requests. For example, describe your calendar conventions so the AI understands your terminology.",
		});
		desc.style.marginBottom = "8px";

		const listEl = containerEl.createDiv({ cls: cls("custom-prompt-list") });

		const renderList = (): void => {
			listEl.empty();
			const prompts = this.mainSettingsStore.currentSettings.ai.customPrompts;

			for (const prompt of prompts) {
				const item = listEl.createDiv({ cls: cls("custom-prompt-item") });

				const info = item.createDiv({ cls: cls("custom-prompt-info") });
				info.createDiv({ cls: cls("custom-prompt-title"), text: prompt.title });
				const preview = prompt.content.length > 80 ? prompt.content.slice(0, 80) + "..." : prompt.content;
				info.createDiv({ cls: cls("custom-prompt-content"), text: preview });

				const actions = item.createDiv({ cls: cls("custom-prompt-actions") });

				const editBtn = actions.createEl("button", { text: "Edit", cls: cls("btn") });
				editBtn.addEventListener("click", () => {
					renderEditForm(listEl, prompt, renderList);
				});

				const deleteBtn = actions.createEl("button", { text: "Delete", cls: `${cls("btn")} ${cls("btn-warning")}` });
				deleteBtn.addEventListener("click", async () => {
					const updated = prompts.filter((p) => p.id !== prompt.id);
					await this.mainSettingsStore.updateSettings((s) => ({
						...s,
						ai: { ...s.ai, customPrompts: updated },
					}));
					renderList();
				});
			}

			if (prompts.length === 0) {
				listEl.createEl("p", {
					cls: cls("hint"),
					text: "No custom prompts defined yet.",
				});
			}
		};

		const renderEditForm = (container: HTMLElement, existing: CustomPrompt | null, onDone: () => void): void => {
			container.empty();

			const form = container.createDiv({ cls: cls("custom-prompt-form") });

			form.createEl("label", { text: "Title", cls: cls("filter-label") });
			const titleInput = form.createEl("input", {
				type: "text",
				placeholder: "e.g. My calendar conventions",
				cls: cls("filter-input"),
			});
			titleInput.value = existing?.title ?? "";

			form.createEl("label", { text: "Content", cls: cls("filter-label") });
			const contentTextarea = form.createEl("textarea", {
				cls: cls("transform-editor"),
				placeholder: "e.g. All-day events use the Date property. Work events are in the Work category.",
			});
			contentTextarea.rows = 4;
			contentTextarea.value = existing?.content ?? "";

			const btnRow = form.createDiv({ cls: cls("row") });

			const saveBtn = btnRow.createEl("button", { text: "Save", cls: `${cls("btn")} ${cls("btn-cta")}` });
			saveBtn.addEventListener("click", async () => {
				const title = titleInput.value.trim();
				const content = contentTextarea.value.trim();
				if (!title || !content) return;

				const prompts = [...this.mainSettingsStore.currentSettings.ai.customPrompts];

				if (existing) {
					const idx = prompts.findIndex((p) => p.id === existing.id);
					if (idx !== -1) {
						prompts[idx] = { ...existing, title, content };
					}
				} else {
					prompts.push({
						id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
						title,
						content,
					});
				}

				await this.mainSettingsStore.updateSettings((s) => ({
					...s,
					ai: { ...s.ai, customPrompts: prompts },
				}));
				onDone();
			});

			const cancelBtn = btnRow.createEl("button", { text: "Cancel", cls: cls("btn") });
			cancelBtn.addEventListener("click", () => {
				onDone();
			});
		};

		renderList();

		const addBtn = containerEl.createEl("button", {
			text: "+ Add Prompt",
			cls: `${cls("btn")} ${cls("btn-add")} ${cls("custom-prompt-add")}`,
		});
		addBtn.addEventListener("click", () => {
			renderEditForm(listEl, null, renderList);
		});
	}
}
