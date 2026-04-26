import type { ColorRule } from "@real1ty-obsidian-plugins";
import { SchemaSection, SettingHeading, SettingItem, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { type FilterPreset, type SingleCalendarConfig, SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

interface RulesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

export const RulesSettingsReact = memo(function RulesSettingsReact({ settingsStore }: RulesSettingsProps) {
	const [settings, updateSettings] = useSettingsStore(settingsStore);

	return (
		<>
			<ColorRulesSection settings={settings} updateSettings={updateSettings} settingsStore={settingsStore} />
			<FilterSection settings={settings} store={settingsStore} />
			<UntrackedFilterSection store={settingsStore} />
			<FilterPresetsSection settings={settings} updateSettings={updateSettings} />
		</>
	);
});

// ─── Color Rules ────────────────────────────────────────────────────────

interface ColorRulesSectionProps {
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
	settingsStore: CalendarSettingsStore;
}

const COLOR_RULE_EXAMPLES = [
	{ expression: "Priority === 'High'", color: "#ef4444", description: "High priority events in red" },
	{ expression: "Status === 'Done'", color: "#22c55e", description: "Completed events in green" },
	{ expression: "Project === 'Work'", color: "#3b82f6", description: "Work projects in blue" },
	{ expression: "Type === 'Meeting'", color: "#f59e0b", description: "Meetings in orange" },
];

const ColorRulesSection = memo(function ColorRulesSection({
	settings,
	updateSettings,
	settingsStore,
}: ColorRulesSectionProps) {
	const handleAddRule = useCallback(() => {
		const newRule: ColorRule = {
			id: `color-rule-${Date.now()}`,
			expression: "",
			color: "hsl(200, 70%, 50%)",
			enabled: true,
		};
		void updateSettings((s) => ({ ...s, colorRules: [...s.colorRules, newRule] }));
	}, [updateSettings]);

	return (
		<>
			<SchemaSection
				store={settingsStore}
				shape={S}
				heading="Event colors"
				fields={["colorMode", "showEventColorDots", "defaultNodeColor"]}
				testIdPrefix="prisma-settings-"
			/>

			<div>
				<p>
					Define color rules based on frontmatter properties. Rules are evaluated in order - the first matching rule
					determines the event color.
				</p>
				<ExamplesList title="Example color rules:" examples={COLOR_RULE_EXAMPLES} />
				<div className="prisma-settings-warning-box">
					<strong>&#9888;&#65039; important:</strong>
					<p>Use property names directly — invalid expressions will be ignored</p>
				</div>
			</div>

			<ColorRulesList settings={settings} updateSettings={updateSettings} />

			<SettingItem name="Add color rule" description="Add a new color rule">
				<button type="button" onClick={handleAddRule} data-testid="prisma-rules-add-color-rule">
					Add rule
				</button>
			</SettingItem>
		</>
	);
});

// ─── Color Rules List ───────────────────────────────────────────────────

interface ColorRulesListProps {
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
}

const ColorRulesList = memo(function ColorRulesList({ settings, updateSettings }: ColorRulesListProps) {
	const { colorRules } = settings;

	const updateRule = useCallback(
		(id: string, patch: Partial<ColorRule>) => {
			void updateSettings((s) => ({
				...s,
				colorRules: s.colorRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
			}));
		},
		[updateSettings]
	);

	const deleteRule = useCallback(
		(id: string) => {
			void updateSettings((s) => ({
				...s,
				colorRules: s.colorRules.filter((r) => r.id !== id),
			}));
		},
		[updateSettings]
	);

	const moveRule = useCallback(
		(index: number, direction: "up" | "down") => {
			void updateSettings((s) => {
				const rules = [...s.colorRules];
				const toIndex = direction === "up" ? index - 1 : index + 1;
				if (toIndex < 0 || toIndex >= rules.length) return s;
				[rules[index], rules[toIndex]] = [rules[toIndex], rules[index]];
				return { ...s, colorRules: rules };
			});
		},
		[updateSettings]
	);

	if (colorRules.length === 0) {
		return <div>No color rules defined. Click &apos;add rule&apos; to create one.</div>;
	}

	return (
		<div>
			{colorRules.map((rule, index) => (
				<ColorRuleItem
					key={rule.id}
					rule={rule}
					index={index}
					total={colorRules.length}
					onUpdate={updateRule}
					onDelete={deleteRule}
					onMove={moveRule}
				/>
			))}
		</div>
	);
});

interface ColorRuleItemProps {
	rule: ColorRule;
	index: number;
	total: number;
	onUpdate: (id: string, patch: Partial<ColorRule>) => void;
	onDelete: (id: string) => void;
	onMove: (index: number, direction: "up" | "down") => void;
}

const ColorRuleItem = memo(function ColorRuleItem({
	rule,
	index,
	total,
	onUpdate,
	onDelete,
	onMove,
}: ColorRuleItemProps) {
	const [localExpression, setLocalExpression] = useState(rule.expression);

	const commitExpression = useCallback(() => {
		if (localExpression !== rule.expression) {
			onUpdate(rule.id, { expression: localExpression });
		}
	}, [localExpression, rule.expression, rule.id, onUpdate]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitExpression();
			}
		},
		[commitExpression]
	);

	return (
		<div className="prisma-color-rule-item">
			<div className="prisma-color-rule-main-row">
				<div className="prisma-color-rule-left">
					<span className="prisma-color-rule-order">#{index + 1}</span>
					<input
						type="checkbox"
						checked={rule.enabled}
						onChange={(e) => onUpdate(rule.id, { enabled: e.target.checked })}
					/>
					<input
						type="text"
						value={localExpression}
						placeholder="Priority === 'High'"
						className="prisma-color-rule-expression-input"
						onChange={(e) => setLocalExpression(e.target.value)}
						onBlur={commitExpression}
						onKeyDown={handleKeyDown}
						data-testid={`prisma-rules-color-expression-${index}`}
					/>
				</div>
				<div className="prisma-color-rule-right">
					<input
						type="color"
						value={rule.color}
						className="prisma-color-rule-picker"
						onChange={(e) => onUpdate(rule.id, { color: e.target.value })}
						data-testid={`prisma-rules-color-picker-${index}`}
					/>
					<div className="prisma-color-rule-controls">
						{index > 0 && (
							<button
								type="button"
								className="prisma-color-rule-btn"
								title="Move up"
								onClick={() => onMove(index, "up")}
							>
								&uarr;
							</button>
						)}
						{index < total - 1 && (
							<button
								type="button"
								className="prisma-color-rule-btn"
								title="Move down"
								onClick={() => onMove(index, "down")}
							>
								&darr;
							</button>
						)}
						<button
							type="button"
							className="prisma-color-rule-btn prisma-color-rule-btn-delete"
							title="Delete rule"
							onClick={() => onDelete(rule.id)}
						>
							&times;
						</button>
					</div>
				</div>
			</div>
		</div>
	);
});

// ─── Filter Sections ────────────────────────────────────────────────────

const FILTER_EXAMPLES = [
	{ expression: "Status !== 'Inbox'", description: "Exclude inbox items" },
	{ expression: "Priority === 'High'", description: "Only high priority events" },
	{ expression: "Status === 'Done' || Status === 'In Progress'", description: "Active or completed events" },
	{ expression: "!_Archived", description: "Exclude archived events" },
	{ expression: "Array.isArray(Project) && Project.length > 0", description: "Events with projects assigned" },
];

const UNTRACKED_FILTER_EXAMPLES = [
	{ expression: "Status !== 'Inbox'", description: "Exclude inbox items" },
	{ expression: "Type === 'Task'", description: "Only show tasks" },
	{ expression: "!_Archived", description: "Exclude archived events" },
];

interface FilterSectionProps {
	settings: SingleCalendarConfig;
	store: CalendarSettingsStore;
}

const FilterSection = memo(function FilterSection({ store }: FilterSectionProps) {
	return (
		<>
			<SettingHeading name="Event filtering" />
			<div>
				<p>
					Filter events based on their frontmatter properties using JavaScript expressions. Each expression should
					evaluate to true/false. Events must pass all filters to be included.
				</p>
				<ExamplesList title="Example filter expressions" examples={FILTER_EXAMPLES} />
				<div className="prisma-settings-warning-box">
					<strong>&#9888;&#65039; important:</strong>
					<p>
						Use property names directly (e.g., status, priority). Invalid expressions will be ignored and logged to
						console.
					</p>
				</div>
			</div>
			<SchemaSection store={store} shape={{ filterExpressions: S.filterExpressions }} testIdPrefix="prisma-settings-" />
		</>
	);
});

interface UntrackedFilterSectionProps {
	store: CalendarSettingsStore;
}

const UntrackedFilterSection = memo(function UntrackedFilterSection({ store }: UntrackedFilterSectionProps) {
	return (
		<>
			<SettingHeading name="Untracked event filtering" />
			<div>
				<p>
					Filter untracked events (events without dates) based on their frontmatter properties. This works the same as
					event filtering but only applies to untracked events in the dropdown.
				</p>
				<ExamplesList title="Example filter expressions" examples={UNTRACKED_FILTER_EXAMPLES} />
				<div className="prisma-settings-warning-box">
					<strong>&#9888;&#65039; important:</strong>
					<p>Use property names directly. Invalid expressions will be ignored and logged to console.</p>
				</div>
			</div>
			<SchemaSection
				store={store}
				shape={{ untrackedFilterExpressions: S.untrackedFilterExpressions }}
				testIdPrefix="prisma-settings-"
			/>
		</>
	);
});

// ─── Filter Presets ─────────────────────────────────────────────────────

const FILTER_PRESET_EXAMPLES = [
	{ expression: "Status === 'Done'", description: "Done tasks preset" },
	{ expression: "Priority === 'High'", description: "High priority preset" },
	{ expression: "Project === 'Work'", description: "Work projects preset" },
	{ expression: "!_Archived", description: "Not archived preset" },
];

interface FilterPresetsSectionProps {
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
}

const FilterPresetsSection = memo(function FilterPresetsSection({
	settings,
	updateSettings,
}: FilterPresetsSectionProps) {
	const handleAdd = useCallback(() => {
		void updateSettings((s) => ({
			...s,
			filterPresets: [...s.filterPresets, { name: "", expression: "" }],
		}));
	}, [updateSettings]);

	return (
		<>
			<SettingHeading name="Filter presets" />
			<div>
				<p>
					Create named filter presets for quick access via a dropdown in the calendar toolbar. These presets auto-fill
					the filter expression input.
				</p>
				<ExamplesList title="Example filter presets" examples={FILTER_PRESET_EXAMPLES} />
				<div className="prisma-settings-warning-box">
					<strong>&#128161; tip:</strong>
					<p>
						Filter presets appear in a dropdown next to the zoom button. Click a preset to instantly apply its filter
						expression.
					</p>
				</div>
			</div>

			<FilterPresetsList settings={settings} updateSettings={updateSettings} />

			<SettingItem name="Add filter preset" description="Add a new filter preset">
				<button type="button" onClick={handleAdd}>
					Add preset
				</button>
			</SettingItem>
		</>
	);
});

interface FilterPresetsListProps {
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
}

const FilterPresetsList = memo(function FilterPresetsList({ settings, updateSettings }: FilterPresetsListProps) {
	const { filterPresets } = settings;

	const updatePreset = useCallback(
		(index: number, patch: Partial<FilterPreset>) => {
			void updateSettings((s) => ({
				...s,
				filterPresets: s.filterPresets.map((p, i) => (i === index ? { ...p, ...patch } : p)),
			}));
		},
		[updateSettings]
	);

	const deletePreset = useCallback(
		(index: number) => {
			void updateSettings((s) => ({
				...s,
				filterPresets: s.filterPresets.filter((_, i) => i !== index),
			}));
		},
		[updateSettings]
	);

	if (filterPresets.length === 0) {
		return <div>No filter presets defined. Click &apos;add preset&apos; to create one.</div>;
	}

	return (
		<div>
			{filterPresets.map((preset, index) => (
				<FilterPresetItem key={index} preset={preset} index={index} onUpdate={updatePreset} onDelete={deletePreset} />
			))}
		</div>
	);
});

interface FilterPresetItemProps {
	preset: FilterPreset;
	index: number;
	onUpdate: (index: number, patch: Partial<FilterPreset>) => void;
	onDelete: (index: number) => void;
}

const FilterPresetItem = memo(function FilterPresetItem({ preset, index, onUpdate, onDelete }: FilterPresetItemProps) {
	const [localName, setLocalName] = useState(preset.name);
	const [localExpression, setLocalExpression] = useState(preset.expression);

	const commitName = useCallback(() => {
		if (localName !== preset.name) onUpdate(index, { name: localName });
	}, [localName, preset.name, index, onUpdate]);

	const commitExpression = useCallback(() => {
		if (localExpression !== preset.expression) onUpdate(index, { expression: localExpression });
	}, [localExpression, preset.expression, index, onUpdate]);

	const handleNameKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitName();
			}
		},
		[commitName]
	);

	const handleExpressionKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitExpression();
			}
		},
		[commitExpression]
	);

	return (
		<div className="prisma-filter-preset-item">
			<input
				type="text"
				value={localName}
				placeholder="Preset name (e.g., 'Done', 'High Priority')"
				className="prisma-filter-preset-name-input"
				onChange={(e) => setLocalName(e.target.value)}
				onBlur={commitName}
				onKeyDown={handleNameKeyDown}
			/>
			<input
				type="text"
				value={localExpression}
				placeholder="Filter expression (e.g., Status === 'Done')"
				className="prisma-filter-preset-expression-input"
				onChange={(e) => setLocalExpression(e.target.value)}
				onBlur={commitExpression}
				onKeyDown={handleExpressionKeyDown}
			/>
			<button
				type="button"
				className="prisma-filter-preset-btn-delete"
				title="Delete preset"
				onClick={() => onDelete(index)}
			>
				&times;
			</button>
		</div>
	);
});

// ─── Examples List ──────────────────────────────────────────────────────

interface ExampleItem {
	expression: string;
	description: string;
	color?: string;
}

const ExamplesList = memo(function ExamplesList({ title, examples }: { title: string; examples: ExampleItem[] }) {
	return (
		<div className="prisma-settings-info-box">
			<strong>{title}</strong>
			<ul>
				{examples.map((ex) => (
					<li key={ex.expression} className="prisma-color-example-item">
						<code className="prisma-settings-info-box-example">{ex.expression}</code>
						<span className="prisma-color-arrow">&rarr;</span>
						{ex.color && (
							<span
								className="prisma-color-example-dot"
								style={{ "--example-color": ex.color } as React.CSSProperties}
							/>
						)}
						<span className="prisma-color-example-description">{ex.description}</span>
					</li>
				))}
			</ul>
		</div>
	);
});
