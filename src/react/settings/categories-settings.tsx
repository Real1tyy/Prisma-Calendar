import { hexToRgb, type PieChartData } from "@real1ty-obsidian-plugins";
import {
	ObsidianIcon,
	PieChart,
	SchemaSection,
	SettingHeading,
	useApp,
	useSettingsStore,
} from "@real1ty-obsidian-plugins-react";
import Chart from "chart.js/auto";
import { nanoid } from "nanoid";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Observable } from "rxjs";

import { showCategoryDeleteModal, showCategoryEventsModal, showCategoryRenameModal } from "../../components/modals";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CategoryInfo, CategoryTracker } from "../../core/category-tracker";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { isAllDayEvent, isTimedEvent } from "../../types/calendar";
import {
	type CategoryAssignmentPreset,
	type SingleCalendarConfig,
	SingleCalendarConfigSchema,
} from "../../types/settings";
import { ProUpgradeBanner } from "./pro-upgrade-banner";

const S = SingleCalendarConfigSchema.shape;

interface CategoriesSettingsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

export const CategoriesSettingsReact = memo(function CategoriesSettingsReact({
	settingsStore,
	plugin,
}: CategoriesSettingsProps) {
	const app = useApp();
	const [settings, updateSettings] = useSettingsStore(settingsStore);

	const bundle = useMemo(
		() => plugin.calendarBundles.find((b) => b.calendarId === settingsStore.calendarId),
		[plugin.calendarBundles, settingsStore.calendarId]
	);

	if (!bundle) {
		return <p className="setting-item-description">Calendar bundle not found. Please refresh the settings.</p>;
	}

	const categoryTracker = bundle.categoryTracker;
	const categoryProp = settings.categoryProp;

	return (
		<>
			<SettingHeading name="Categories" />
			<div>
				<p>
					Categories are automatically detected from the &quot;{categoryProp}&quot; property in your events. Configure
					colors for each category below.
				</p>
			</div>

			<EventStatsSection bundle={bundle} />
			<CategoriesListSection
				categoryTracker={categoryTracker}
				categoryProp={categoryProp}
				settingsStore={settingsStore}
				settings={settings}
				app={app}
			/>
			<CategoryChartSection categoryTracker={categoryTracker} categoryProp={categoryProp} settings={settings} />
			<AutoAssignSection
				settingsStore={settingsStore}
				settings={settings}
				updateSettings={updateSettings}
				plugin={plugin}
				categoryTracker={categoryTracker}
			/>
		</>
	);
});

// ─── Event Stats ────────────────────────────────────────────────────────

const EventStatsSection = memo(function EventStatsSection({ bundle }: { bundle: CalendarBundle }) {
	const allEvents = bundle.eventStore.getAllEvents();
	const totalEvents = allEvents.length;
	const timedCount = allEvents.filter((e) => isTimedEvent(e)).length;
	const allDayCount = allEvents.filter((e) => isAllDayEvent(e)).length;

	const timedPercentage = totalEvents > 0 ? ((timedCount / totalEvents) * 100).toFixed(1) : "0.0";
	const allDayPercentage = totalEvents > 0 ? ((allDayCount / totalEvents) * 100).toFixed(1) : "0.0";

	return (
		<div className="prisma-categories-stats-container">
			<div className="prisma-categories-stats-grid">
				<div className="prisma-category-stat-item">
					<div className="prisma-category-stat-label">Total Events</div>
					<div className="prisma-category-stat-value">{totalEvents}</div>
				</div>
				<div className="prisma-category-stat-item">
					<div className="prisma-category-stat-label">Timed</div>
					<div className="prisma-category-stat-value">
						{timedCount} ({timedPercentage}%)
					</div>
				</div>
				<div className="prisma-category-stat-item">
					<div className="prisma-category-stat-label">All-day</div>
					<div className="prisma-category-stat-value">
						{allDayCount} ({allDayPercentage}%)
					</div>
				</div>
			</div>
		</div>
	);
});

// ─── Categories List ────────────────────────────────────────────────────

interface CategoriesListSectionProps {
	categoryTracker: CategoryTracker;
	categoryProp: string;
	settingsStore: CalendarSettingsStore;
	settings: SingleCalendarConfig;
	app: ReturnType<typeof useApp>;
}

const CategoriesListSection = memo(function CategoriesListSection({
	categoryTracker,
	categoryProp,
	settingsStore,
	settings,
	app,
}: CategoriesListSectionProps) {
	const categoriesVersion = useCategoriesVersion(categoryTracker.categories$);

	const categories = useMemo(() => categoryTracker.getCategories(), [categoriesVersion]);

	const categoriesInfo = useMemo(() => {
		const infos = categories.map((category) => {
			const stats = categoryTracker.getCategoryStats(category);
			const color = getCategoryColor(category, settings.colorRules, categoryProp, settings.defaultNodeColor);
			return { name: category, count: stats.total, timedCount: stats.timed, allDayCount: stats.allDay, color };
		});
		infos.sort((a, b) => b.count - a.count);
		return infos;
	}, [categories, categoryTracker, settings.colorRules, categoryProp, settings.defaultNodeColor]);

	const totalCount = useMemo(() => categoriesInfo.reduce((sum, c) => sum + c.count, 0), [categoriesInfo]);

	const handleColorChange = useCallback(
		(category: string, color: string) => {
			const expectedExpression = getCategoryExpression(category, categoryProp);
			const existingIndex = settings.colorRules.findIndex((r) => r.expression === expectedExpression);

			if (existingIndex !== -1) {
				void settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r, i) => (i === existingIndex ? { ...r, color } : r)),
				}));
			} else {
				void settingsStore.updateSettings((s) => ({
					...s,
					colorRules: [
						...s.colorRules,
						{ id: `category-color-${category}-${Date.now()}`, expression: expectedExpression, color, enabled: true },
					],
				}));
			}
		},
		[settings.colorRules, categoryProp, settingsStore]
	);

	const handleRename = useCallback(
		(categoryName: string) => {
			showCategoryRenameModal(app, categoryTracker, settingsStore, categoryName, () => {});
		},
		[app, categoryTracker, settingsStore]
	);

	const handleDelete = useCallback(
		(categoryName: string) => {
			showCategoryDeleteModal(app, categoryTracker, settingsStore, categoryName, () => {});
		},
		[app, categoryTracker, settingsStore]
	);

	const handleClickCategory = useCallback(
		(categoryName: string) => {
			showCategoryEventsModal(app, categoryName, settings);
		},
		[app, settings]
	);

	if (categories.length === 0) {
		return (
			<div className="prisma-categories-empty-state">
				No categories found. Add a &quot;{categoryProp}&quot; property to your events to see them here.
			</div>
		);
	}

	return (
		<div>
			{categoriesInfo.map((info) => {
				const percentage = totalCount > 0 ? ((info.count / totalCount) * 100).toFixed(1) : "0.0";
				const timedPct = info.count > 0 ? ((info.timedCount / info.count) * 100).toFixed(0) : "0";
				const allDayPct = info.count > 0 ? ((info.allDayCount / info.count) * 100).toFixed(0) : "0";
				const rgb = hexToRgb(info.color);

				return (
					<div
						key={info.name}
						className="prisma-category-settings-item"
						data-testid="prisma-category-settings-item"
						data-category={info.name}
						style={
							rgb ? ({ "--category-color-rgb": `${rgb.r}, ${rgb.g}, ${rgb.b}` } as React.CSSProperties) : undefined
						}
					>
						<div className="prisma-category-settings-item-left">
							<div className="prisma-category-settings-name-container" onClick={() => handleClickCategory(info.name)}>
								<span className="prisma-category-settings-name">{info.name}</span>
								<span className="prisma-category-settings-count">
									{info.count} total ({percentage}%) &bull; {info.timedCount} timed ({timedPct}%) &bull;{" "}
									{info.allDayCount} all-day ({allDayPct}%)
								</span>
							</div>
						</div>
						<div className="prisma-category-settings-item-right">
							<button
								type="button"
								className="prisma-category-settings-edit-button"
								aria-label="Rename category"
								data-testid="prisma-category-settings-rename-button"
								onClick={() => handleRename(info.name)}
							>
								<ObsidianIcon icon="pencil" />
							</button>
							<button
								type="button"
								className="prisma-category-settings-delete-button"
								aria-label="Delete category"
								data-testid="prisma-category-settings-delete-button"
								onClick={() => handleDelete(info.name)}
							>
								<ObsidianIcon icon="trash" />
							</button>
							<input type="color" value={info.color} onChange={(e) => handleColorChange(info.name, e.target.value)} />
						</div>
					</div>
				);
			})}
		</div>
	);
});

// ─── Category Chart ─────────────────────────────────────────────────────

interface CategoryChartSectionProps {
	categoryTracker: CategoryTracker;
	categoryProp: string;
	settings: SingleCalendarConfig;
}

const CategoryChartSection = memo(function CategoryChartSection({
	categoryTracker,
	categoryProp,
	settings,
}: CategoryChartSectionProps) {
	const categoriesVersion = useCategoriesVersion(categoryTracker.categories$);

	const chartData = useMemo<PieChartData>(() => {
		const categories = categoryTracker.getCategories();
		const items = categories.map((category) => {
			const events = categoryTracker.getEventsWithCategory(category);
			const color = getCategoryColor(category, settings.colorRules, categoryProp, settings.defaultNodeColor);
			return { label: category, value: events.length, color };
		});
		items.sort((a, b) => b.value - a.value);
		return { labels: items.map((i) => i.label), values: items.map((i) => i.value), colors: items.map((i) => i.color) };
	}, [categoriesVersion, categoryTracker, settings.colorRules, categoryProp, settings.defaultNodeColor]);

	if (chartData.values.length === 0) return null;

	return (
		<div className="prisma-categories-chart-section">
			<PieChart
				data={chartData}
				ChartJS={Chart}
				cssPrefix="prisma-"
				title="Category distribution"
				valueFormatter={(v) => `${v} ${v === 1 ? "event" : "events"}`}
			/>
		</div>
	);
});

// ─── Auto-assign Categories ─────────────────────────────────────────────

interface AutoAssignSectionProps {
	settingsStore: CalendarSettingsStore;
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
	plugin: CustomCalendarPlugin;
	categoryTracker: CategoryTracker;
}

const AutoAssignSection = memo(function AutoAssignSection({
	settingsStore,
	settings,
	updateSettings,
	plugin,
	categoryTracker,
}: AutoAssignSectionProps) {
	const handleAddPreset = useCallback(() => {
		void updateSettings((s) => ({
			...s,
			categoryAssignmentPresets: [
				...(s.categoryAssignmentPresets || []),
				{ id: nanoid(), eventName: "", categories: [] },
			],
		}));
	}, [updateSettings]);

	return (
		<>
			<SettingHeading name="Auto-assign categories" />
			<div>
				<p>Automatically assign categories to events during creation based on the event name.</p>
			</div>

			<SchemaSection
				store={settingsStore}
				shape={{
					autoAssignCategoryByName: S.autoAssignCategoryByName,
					autoAssignCategoryByIncludes: S.autoAssignCategoryByIncludes,
				}}
				testIdPrefix="prisma-settings-"
			/>

			{!plugin.isProEnabled ? (
				<ProUpgradeBanner
					featureName="Custom Category Assignment Presets"
					description="Define custom rules to auto-assign categories based on event names. Each preset can assign multiple categories to events with a specific name."
				/>
			) : (
				<>
					<SettingHeading name="Custom category assignment presets" />
					<div className="prisma-settings-info-box">
						<strong>Examples:</strong>
						<ul>
							<li>Event names: &apos;Coding, Work, Dev&apos; &rarr; Auto-assign categories: Software, Business</li>
							<li>Event names: &apos;Gym, Exercise&apos; &rarr; Auto-assign categories: Health, Fitness</li>
						</ul>
					</div>

					<CategoryAssignmentPresetsList
						settings={settings}
						updateSettings={updateSettings}
						categoryTracker={categoryTracker}
					/>

					<button type="button" className="prisma-settings-button" onClick={handleAddPreset}>
						Add preset
					</button>
				</>
			)}
		</>
	);
});

// ─── Category Assignment Presets List ────────────────────────────────────

interface PresetsListProps {
	settings: SingleCalendarConfig;
	updateSettings: (updater: (s: SingleCalendarConfig) => SingleCalendarConfig) => Promise<void>;
	categoryTracker: CategoryTracker;
}

const CategoryAssignmentPresetsList = memo(function CategoryAssignmentPresetsList({
	settings,
	updateSettings,
	categoryTracker,
}: PresetsListProps) {
	const presets = settings.categoryAssignmentPresets || [];

	const updatePreset = useCallback(
		(id: string, updated: CategoryAssignmentPreset) => {
			void updateSettings((s) => ({
				...s,
				categoryAssignmentPresets: (s.categoryAssignmentPresets || []).map((p) => (p.id === id ? updated : p)),
			}));
		},
		[updateSettings]
	);

	const deletePreset = useCallback(
		(id: string) => {
			void updateSettings((s) => ({
				...s,
				categoryAssignmentPresets: (s.categoryAssignmentPresets || []).filter((p) => p.id !== id),
			}));
		},
		[updateSettings]
	);

	if (presets.length === 0) {
		return <div className="prisma-category-assignment-empty">No custom category assignment presets defined.</div>;
	}

	return (
		<div>
			{presets.map((preset) => (
				<CategoryAssignmentPresetRow
					key={preset.id}
					preset={preset}
					settings={settings}
					categoryTracker={categoryTracker}
					onUpdate={updatePreset}
					onDelete={deletePreset}
				/>
			))}
		</div>
	);
});

interface PresetRowProps {
	preset: CategoryAssignmentPreset;
	settings: SingleCalendarConfig;
	categoryTracker: CategoryTracker;
	onUpdate: (id: string, updated: CategoryAssignmentPreset) => void;
	onDelete: (id: string) => void;
}

const CategoryAssignmentPresetRow = memo(function CategoryAssignmentPresetRow({
	preset,
	settings,
	categoryTracker,
	onUpdate,
	onDelete,
}: PresetRowProps) {
	const [localName, setLocalName] = useState(preset.eventName);

	const commitName = useCallback(() => {
		const trimmed = localName.trim();
		if (trimmed !== preset.eventName) {
			onUpdate(preset.id, { ...preset, eventName: trimmed });
		}
	}, [localName, preset, onUpdate]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitName();
			}
		},
		[commitName]
	);

	const availableCategories = useMemo(() => {
		const all = categoryTracker.getCategories();
		return all.filter((c) => !preset.categories.includes(c));
	}, [categoryTracker, preset.categories]);

	const handleAddCategory = useCallback(
		(category: string) => {
			if (category && !preset.categories.includes(category)) {
				onUpdate(preset.id, {
					...preset,
					eventName: localName.trim(),
					categories: [...preset.categories, category],
				});
			}
		},
		[preset, localName, onUpdate]
	);

	const handleRemoveCategory = useCallback(
		(category: string) => {
			onUpdate(preset.id, {
				...preset,
				eventName: localName.trim(),
				categories: preset.categories.filter((c) => c !== category),
			});
		},
		[preset, localName, onUpdate]
	);

	const categoryProp = settings.categoryProp;

	return (
		<div className="prisma-category-assignment-preset">
			<input
				type="text"
				value={localName}
				placeholder="Event name(s) - comma separated (e.g., Coding, Work, Dev)"
				className="prisma-category-assignment-name-input"
				data-preset-id={preset.id}
				onChange={(e) => setLocalName(e.target.value)}
				onBlur={commitName}
				onKeyDown={handleKeyDown}
			/>
			<span className="prisma-category-assignment-arrow">&rarr;</span>
			<div className="prisma-category-assignment-categories">
				<div className="prisma-category-assignment-select-container">
					<div className="prisma-category-assignment-selected">
						{preset.categories.length === 0 ? (
							<span className="prisma-category-assignment-empty-selection">No categories</span>
						) : (
							preset.categories.map((category) => {
								const color = getCategoryColor(category, settings.colorRules, categoryProp, settings.defaultNodeColor);
								return (
									<div
										key={category}
										className="prisma-category-assignment-tag"
										style={{ "--category-color": color } as React.CSSProperties}
									>
										<span>{category}</span>
										<button
											type="button"
											className="prisma-category-assignment-tag-remove"
											onClick={() => handleRemoveCategory(category)}
										>
											&times;
										</button>
									</div>
								);
							})
						)}
					</div>
					<div className="prisma-category-assignment-add-container">
						<select
							className="prisma-category-assignment-add-dropdown-hidden"
							value=""
							onChange={(e) => {
								handleAddCategory(e.target.value);
								e.target.value = "";
							}}
						>
							<option value="" disabled hidden />
							{availableCategories.map((cat) => (
								<option key={cat} value={cat}>
									{cat}
								</option>
							))}
						</select>
						<button type="button" className="prisma-category-assignment-add-button" title="Add category">
							+
						</button>
					</div>
				</div>
			</div>
			<button
				type="button"
				className="prisma-category-assignment-delete-button"
				title="Delete preset"
				onClick={() => onDelete(preset.id)}
			>
				&times;
			</button>
		</div>
	);
});

// ─── Helpers ────────────────────────────────────────────────────────────

function getCategoryExpression(category: string, categoryProp: string): string {
	const escapedCategory = category.replace(/'/g, "\\'");
	return `${categoryProp}.includes('${escapedCategory}')`;
}

function useCategoriesVersion(categories$: Observable<CategoryInfo[]>): number {
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const sub = categories$.subscribe(() => setVersion((v) => v + 1));
		return () => sub.unsubscribe();
	}, [categories$]);
	return version;
}

function getCategoryColor(
	category: string,
	colorRules: Array<{ id: string; expression: string; color: string; enabled: boolean }>,
	categoryProp: string,
	defaultColor: string
): string {
	const expectedExpression = getCategoryExpression(category, categoryProp);
	for (const rule of colorRules) {
		if (rule.enabled && rule.expression === expectedExpression) {
			return rule.color;
		}
	}
	return defaultColor;
}
