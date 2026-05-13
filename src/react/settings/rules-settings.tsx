import type { ColorRule } from "@real1ty-obsidian-plugins";
import { cls, tid } from "@real1ty-obsidian-plugins";
import { ColorInput, SettingHeading, SettingItem, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { type FilterPreset, SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

const S = SingleCalendarConfigSchema.shape;

interface RulesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

export const RulesSettingsReact = memo(function RulesSettingsReact({ settingsStore }: RulesSettingsProps) {
	return (
		<>
			<ColorRulesSection settingsStore={settingsStore} />
			<FilterSection store={settingsStore} />
			<UntrackedFilterSection store={settingsStore} />
			<FilterPresetsSection settingsStore={settingsStore} />
		</>
	);
});

// ─── Color Rules ────────────────────────────────────────────────────────

interface ColorRulesSectionProps {
	settingsStore: CalendarSettingsStore;
}

const COLOR_RULE_EXAMPLES = [
	{ expression: "Priority === 'High'", color: "#ef4444", description: "High priority events in red" },
	{ expression: "Status === 'Done'", color: "#22c55e", description: "Completed events in green" },
	{ expression: "Project === 'Work'", color: "#3b82f6", description: "Work projects in blue" },
	{ expression: "Type === 'Meeting'", color: "#f59e0b", description: "Meetings in orange" },
];

const ColorRulesSection = memo(function ColorRulesSection({ settingsStore }: ColorRulesSectionProps) {
	const [colorRules, setColorRules] = useSchemaField(settingsStore, "colorRules");

	const handleAddRule = useCallback(() => {
		const newRule: ColorRule = {
			id: `color-rule-${Date.now()}`,
			expression: "",
			color: "hsl(200, 70%, 50%)",
			enabled: true,
		};
		setColorRules((prev) => [...prev, newRule]);
	}, [setColorRules]);

	return (
		<>
			<PrismaSection
				store={settingsStore}
				shape={S}
				heading="Event colors"
				fields={["colorMode", "showEventColorDots", "defaultNodeColor"]}
			/>

			<div>
				<p>
					Define color rules based on frontmatter properties. Rules are evaluated in order - the first matching rule
					determines the event color.
				</p>
				<ExamplesList title="Example color rules:" examples={COLOR_RULE_EXAMPLES} />
				<div className={cls("settings-warning-box")}>
					<strong>&#9888;&#65039; important:</strong>
					<p>Use property names directly — invalid expressions will be ignored</p>
				</div>
			</div>

			<ColorRulesList colorRules={colorRules} setColorRules={setColorRules} />

			<SettingItem name="Add color rule" description="Add a new color rule">
				<button type="button" onClick={handleAddRule} data-testid={tid("rules-add-color-rule")}>
					Add rule
				</button>
			</SettingItem>
		</>
	);
});

// ─── Color Rules List ───────────────────────────────────────────────────

interface ColorRulesListProps {
	colorRules: ColorRule[];
	setColorRules: (next: ColorRule[] | ((prev: ColorRule[]) => ColorRule[])) => void;
}

const ColorRulesList = memo(function ColorRulesList({ colorRules, setColorRules }: ColorRulesListProps) {
	const updateRule = useCallback(
		(id: string, patch: Partial<ColorRule>) => {
			setColorRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
		},
		[setColorRules]
	);

	const deleteRule = useCallback(
		(id: string) => {
			setColorRules((prev) => prev.filter((r) => r.id !== id));
		},
		[setColorRules]
	);

	const moveRule = useCallback(
		(index: number, direction: "up" | "down") => {
			setColorRules((prev) => {
				const rules = [...prev];
				const toIndex = direction === "up" ? index - 1 : index + 1;
				if (toIndex < 0 || toIndex >= rules.length) return prev;
				[rules[index], rules[toIndex]] = [rules[toIndex], rules[index]];
				return rules;
			});
		},
		[setColorRules]
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
		<div className={cls("color-rule-item")}>
			<div className={cls("color-rule-main-row")}>
				<div className={cls("color-rule-left")}>
					<span className={cls("color-rule-order")}>#{index + 1}</span>
					<input
						type="checkbox"
						checked={rule.enabled}
						onChange={(e) => onUpdate(rule.id, { enabled: e.target.checked })}
					/>
					<input
						type="text"
						value={localExpression}
						placeholder="Priority === 'High'"
						className={cls("color-rule-expression-input")}
						onChange={(e) => setLocalExpression(e.target.value)}
						onBlur={commitExpression}
						onKeyDown={handleKeyDown}
						data-testid={tid("rules-color-expression", index)}
					/>
				</div>
				<div className={cls("color-rule-right")}>
					<ColorInput
						value={rule.color}
						onChange={(next) => onUpdate(rule.id, { color: next })}
						testId={tid("rules-color-picker", index)}
					/>
					<div className={cls("color-rule-controls")}>
						{index > 0 && (
							<button
								type="button"
								className={cls("color-rule-btn")}
								title="Move up"
								onClick={() => onMove(index, "up")}
							>
								&uarr;
							</button>
						)}
						{index < total - 1 && (
							<button
								type="button"
								className={cls("color-rule-btn")}
								title="Move down"
								onClick={() => onMove(index, "down")}
							>
								&darr;
							</button>
						)}
						<button
							type="button"
							className={cls("color-rule-btn", "color-rule-btn-delete")}
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
				<div className={cls("settings-warning-box")}>
					<strong>&#9888;&#65039; important:</strong>
					<p>
						Use property names directly (e.g., status, priority). Invalid expressions will be ignored and logged to
						console.
					</p>
				</div>
			</div>
			<PrismaSection store={store} shape={{ filterExpressions: S.filterExpressions }} />
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
				<div className={cls("settings-warning-box")}>
					<strong>&#9888;&#65039; important:</strong>
					<p>Use property names directly. Invalid expressions will be ignored and logged to console.</p>
				</div>
			</div>
			<PrismaSection store={store} shape={{ untrackedFilterExpressions: S.untrackedFilterExpressions }} />
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
	settingsStore: CalendarSettingsStore;
}

const FilterPresetsSection = memo(function FilterPresetsSection({ settingsStore }: FilterPresetsSectionProps) {
	const [filterPresets, setFilterPresets] = useSchemaField(settingsStore, "filterPresets");

	const handleAdd = useCallback(() => {
		setFilterPresets((prev) => [...prev, { name: "", expression: "" }]);
	}, [setFilterPresets]);

	return (
		<>
			<SettingHeading name="Filter presets" />
			<div>
				<p>
					Create named filter presets for quick access via a dropdown in the calendar toolbar. These presets auto-fill
					the filter expression input.
				</p>
				<ExamplesList title="Example filter presets" examples={FILTER_PRESET_EXAMPLES} />
				<div className={cls("settings-warning-box")}>
					<strong>&#128161; tip:</strong>
					<p>
						Filter presets appear in a dropdown next to the zoom button. Click a preset to instantly apply its filter
						expression.
					</p>
				</div>
			</div>

			<FilterPresetsList filterPresets={filterPresets} setFilterPresets={setFilterPresets} />

			<SettingItem name="Add filter preset" description="Add a new filter preset">
				<button type="button" onClick={handleAdd}>
					Add preset
				</button>
			</SettingItem>
		</>
	);
});

interface FilterPresetsListProps {
	filterPresets: FilterPreset[];
	setFilterPresets: (next: FilterPreset[] | ((prev: FilterPreset[]) => FilterPreset[])) => void;
}

const FilterPresetsList = memo(function FilterPresetsList({ filterPresets, setFilterPresets }: FilterPresetsListProps) {
	const updatePreset = useCallback(
		(index: number, patch: Partial<FilterPreset>) => {
			setFilterPresets((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
		},
		[setFilterPresets]
	);

	const deletePreset = useCallback(
		(index: number) => {
			setFilterPresets((prev) => prev.filter((_, i) => i !== index));
		},
		[setFilterPresets]
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
		<div className={cls("filter-preset-item")}>
			<input
				type="text"
				value={localName}
				placeholder="Preset name (e.g., 'Done', 'High Priority')"
				className={cls("filter-preset-name-input")}
				onChange={(e) => setLocalName(e.target.value)}
				onBlur={commitName}
				onKeyDown={handleNameKeyDown}
			/>
			<input
				type="text"
				value={localExpression}
				placeholder="Filter expression (e.g., Status === 'Done')"
				className={cls("filter-preset-expression-input")}
				onChange={(e) => setLocalExpression(e.target.value)}
				onBlur={commitExpression}
				onKeyDown={handleExpressionKeyDown}
			/>
			<button
				type="button"
				className={cls("filter-preset-btn-delete")}
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
		<div className={cls("settings-info-box")}>
			<strong>{title}</strong>
			<ul>
				{examples.map((ex) => (
					<li key={ex.expression} className={cls("color-example-item")}>
						<code className={cls("settings-info-box-example")}>{ex.expression}</code>
						<span className={cls("color-arrow")}>&rarr;</span>
						{ex.color && (
							<span
								className={cls("color-example-dot")}
								style={{ "--example-color": ex.color } as React.CSSProperties}
							/>
						)}
						<span className={cls("color-example-description")}>{ex.description}</span>
					</li>
				))}
			</ul>
		</div>
	);
});
