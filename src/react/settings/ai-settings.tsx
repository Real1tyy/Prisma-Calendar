import { SettingHeading, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import { cls, tid } from "../../constants";
import type { PrismaCalendarSettingsStore } from "../../types";
import { AI_DEFAULTS } from "../../types/ai";
import { CustomCalendarSettingsSchema, type CustomPrompt } from "../../types/settings";
import { PrismaSection } from "./_section";

const AIShape = CustomCalendarSettingsSchema.shape.ai.unwrap().shape;

const MODEL_OPTIONS = Object.fromEntries(Object.entries(AI_DEFAULTS.MODEL_OPTIONS).map(([k, v]) => [k, v.label]));

interface AISettingsProps {
	mainSettingsStore: PrismaCalendarSettingsStore;
}

export const AISettingsReact = memo(function AISettingsReact({ mainSettingsStore }: AISettingsProps) {
	const aiSection = (heading: string, fields: string[]) => (
		<PrismaSection store={mainSettingsStore} shape={AIShape} heading={heading} fields={fields} pathPrefix="ai" />
	);
	return (
		<>
			<PrismaSection
				store={mainSettingsStore}
				shape={AIShape}
				heading="AI Assistant"
				fields={["anthropicApiKeySecretName", "openaiApiKeySecretName", "aiModel"]}
				pathPrefix="ai"
				overrides={{ aiModel: { options: MODEL_OPTIONS, widget: "dropdown" } }}
			/>
			{aiSection("Event Manipulation", ["aiBatchExecution", "aiConfirmExecution"])}
			{aiSection("Planning", ["aiPlanningGapDetection", "aiPlanningDayCoverage"])}
			<CustomPromptsSection mainSettingsStore={mainSettingsStore} />
		</>
	);
});

interface CustomPromptsSectionProps {
	mainSettingsStore: PrismaCalendarSettingsStore;
}

const CustomPromptsSection = memo(function CustomPromptsSection({ mainSettingsStore }: CustomPromptsSectionProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);
	const [prompts, setPrompts] = useSchemaField(mainSettingsStore, "ai.customPrompts");

	const handleDelete = useCallback(
		(id: string) => {
			setPrompts((current) => current.filter((p) => p.id !== id));
		},
		[setPrompts]
	);

	const handleSave = useCallback(
		(prompt: CustomPrompt) => {
			setPrompts((current) => {
				const existing = current.findIndex((p) => p.id === prompt.id);
				return existing !== -1 ? current.map((p, i) => (i === existing ? prompt : p)) : [...current, prompt];
			});
			setEditingId(null);
			setIsAdding(false);
		},
		[setPrompts]
	);

	const handleCancel = useCallback(() => {
		setEditingId(null);
		setIsAdding(false);
	}, []);

	return (
		<>
			<SettingHeading name="Custom Prompts" />
			<p className={cls("hint")}>
				Define reusable context snippets that get prepended to your AI requests. For example, describe your calendar
				conventions so the AI understands your terminology.
			</p>

			<div className={cls("custom-prompt-list")}>
				{prompts.length === 0 && !isAdding && <p className={cls("hint")}>No custom prompts defined yet.</p>}

				{prompts.map((prompt) =>
					editingId === prompt.id ? (
						<PromptEditForm key={prompt.id} existing={prompt} onSave={handleSave} onCancel={handleCancel} />
					) : (
						<PromptItem
							key={prompt.id}
							prompt={prompt}
							onEdit={() => setEditingId(prompt.id)}
							onDelete={() => handleDelete(prompt.id)}
						/>
					)
				)}

				{isAdding && <PromptEditForm existing={null} onSave={handleSave} onCancel={handleCancel} />}
			</div>

			{!isAdding && editingId === null && (
				<button
					type="button"
					className={cls("btn", "btn-add", "custom-prompt-add")}
					onClick={() => setIsAdding(true)}
					data-testid={tid("settings-ai-add-prompt")}
				>
					+ Add Prompt
				</button>
			)}
		</>
	);
});

interface PromptItemProps {
	prompt: CustomPrompt;
	onEdit: () => void;
	onDelete: () => void;
}

const PromptItem = memo(function PromptItem({ prompt, onEdit, onDelete }: PromptItemProps) {
	const preview = prompt.content.length > 80 ? prompt.content.slice(0, 80) + "..." : prompt.content;

	return (
		<div className={cls("custom-prompt-item")}>
			<div className={cls("custom-prompt-info")}>
				<div className={cls("custom-prompt-title")}>{prompt.title}</div>
				<div className={cls("custom-prompt-content")}>{preview}</div>
			</div>
			<div className={cls("custom-prompt-actions")}>
				<button type="button" className={cls("btn")} onClick={onEdit}>
					Edit
				</button>
				<button type="button" className={cls("btn", "btn-warning")} onClick={onDelete}>
					Delete
				</button>
			</div>
		</div>
	);
});

interface PromptEditFormProps {
	existing: CustomPrompt | null;
	onSave: (prompt: CustomPrompt) => void;
	onCancel: () => void;
}

const PromptEditForm = memo(function PromptEditForm({ existing, onSave, onCancel }: PromptEditFormProps) {
	const [title, setTitle] = useState(existing?.title ?? "");
	const [content, setContent] = useState(existing?.content ?? "");

	const handleSave = useCallback(() => {
		const trimmedTitle = title.trim();
		const trimmedContent = content.trim();
		if (!trimmedTitle || !trimmedContent) return;

		onSave({
			id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			title: trimmedTitle,
			content: trimmedContent,
		});
	}, [title, content, existing, onSave]);

	return (
		<div className={cls("custom-prompt-form")}>
			<label className={cls("filter-label")}>Title</label>
			<input
				type="text"
				className={cls("filter-input")}
				placeholder="e.g. My calendar conventions"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				data-testid={tid("settings-ai-prompt-title")}
				autoFocus
			/>
			<label className={cls("filter-label")}>Content</label>
			<textarea
				className={cls("transform-editor")}
				placeholder="e.g. All-day events use the Date property. Work events are in the Work category."
				rows={4}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				data-testid={tid("settings-ai-prompt-content")}
			/>
			<div className={cls("row")}>
				<button type="button" className={cls("btn", "btn-cta")} onClick={handleSave}>
					Save
				</button>
				<button type="button" className={cls("btn")} onClick={onCancel}>
					Cancel
				</button>
			</div>
		</div>
	);
});
