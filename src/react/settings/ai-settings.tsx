import { SchemaSection, SettingHeading, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import type { PrismaCalendarSettingsStore } from "../../types";
import { AI_DEFAULTS } from "../../types/ai";
import { type CustomCalendarSettings, CustomCalendarSettingsSchema, type CustomPrompt } from "../../types/settings";

const AIShape = CustomCalendarSettingsSchema.shape.ai.unwrap().shape;

const MODEL_OPTIONS = Object.fromEntries(Object.entries(AI_DEFAULTS.MODEL_OPTIONS).map(([k, v]) => [k, v.label]));

interface AISettingsProps {
	mainSettingsStore: PrismaCalendarSettingsStore;
}

export const AISettingsReact = memo(function AISettingsReact({ mainSettingsStore }: AISettingsProps) {
	const [settings, updateSettings] = useSettingsStore(mainSettingsStore);

	return (
		<>
			<SchemaSection
				store={mainSettingsStore}
				shape={AIShape}
				heading="AI Assistant"
				fields={["anthropicApiKeySecretName", "openaiApiKeySecretName", "aiModel"]}
				pathPrefix="ai"
				overrides={{ aiModel: { options: MODEL_OPTIONS, widget: "dropdown" } }}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={mainSettingsStore}
				shape={AIShape}
				heading="Event Manipulation"
				fields={["aiBatchExecution", "aiConfirmExecution"]}
				pathPrefix="ai"
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={mainSettingsStore}
				shape={AIShape}
				heading="Planning"
				fields={["aiPlanningGapDetection", "aiPlanningDayCoverage"]}
				pathPrefix="ai"
				testIdPrefix="prisma-settings-"
			/>

			<CustomPromptsSection settings={settings} updateSettings={updateSettings} />
		</>
	);
});

interface CustomPromptsSectionProps {
	settings: CustomCalendarSettings;
	updateSettings: (updater: (s: CustomCalendarSettings) => CustomCalendarSettings) => Promise<void>;
}

const CustomPromptsSection = memo(function CustomPromptsSection({
	settings,
	updateSettings,
}: CustomPromptsSectionProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);
	const prompts = settings.ai.customPrompts;

	const handleDelete = useCallback(
		(id: string) => {
			void updateSettings((s) => ({
				...s,
				ai: { ...s.ai, customPrompts: s.ai.customPrompts.filter((p) => p.id !== id) },
			}));
		},
		[updateSettings]
	);

	const handleSave = useCallback(
		(prompt: CustomPrompt) => {
			void updateSettings((s) => {
				const existing = s.ai.customPrompts.findIndex((p) => p.id === prompt.id);
				const updated =
					existing !== -1
						? s.ai.customPrompts.map((p, i) => (i === existing ? prompt : p))
						: [...s.ai.customPrompts, prompt];
				return { ...s, ai: { ...s.ai, customPrompts: updated } };
			});
			setEditingId(null);
			setIsAdding(false);
		},
		[updateSettings]
	);

	const handleCancel = useCallback(() => {
		setEditingId(null);
		setIsAdding(false);
	}, []);

	return (
		<>
			<SettingHeading name="Custom Prompts" />
			<p className="prisma-hint">
				Define reusable context snippets that get prepended to your AI requests. For example, describe your calendar
				conventions so the AI understands your terminology.
			</p>

			<div className="prisma-custom-prompt-list">
				{prompts.length === 0 && !isAdding && <p className="prisma-hint">No custom prompts defined yet.</p>}

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
					className="prisma-btn prisma-btn-add prisma-custom-prompt-add"
					onClick={() => setIsAdding(true)}
					data-testid="prisma-settings-ai-add-prompt"
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
		<div className="prisma-custom-prompt-item">
			<div className="prisma-custom-prompt-info">
				<div className="prisma-custom-prompt-title">{prompt.title}</div>
				<div className="prisma-custom-prompt-content">{preview}</div>
			</div>
			<div className="prisma-custom-prompt-actions">
				<button type="button" className="prisma-btn" onClick={onEdit}>
					Edit
				</button>
				<button type="button" className="prisma-btn prisma-btn-warning" onClick={onDelete}>
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
		<div className="prisma-custom-prompt-form">
			<label className="prisma-filter-label">Title</label>
			<input
				type="text"
				className="prisma-filter-input"
				placeholder="e.g. My calendar conventions"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				data-testid="prisma-settings-ai-prompt-title"
				autoFocus
			/>
			<label className="prisma-filter-label">Content</label>
			<textarea
				className="prisma-transform-editor"
				placeholder="e.g. All-day events use the Date property. Work events are in the Work category."
				rows={4}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				data-testid="prisma-settings-ai-prompt-content"
			/>
			<div className="prisma-row">
				<button type="button" className="prisma-btn prisma-btn-cta" onClick={handleSave}>
					Save
				</button>
				<button type="button" className="prisma-btn" onClick={onCancel}>
					Cancel
				</button>
			</div>
		</div>
	);
});
