import { ModalDescription, ModalForm, openReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useCallback, useState } from "react";

import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { getAllFrontmatterProperties } from "../../../utils/events/frontmatter";

interface FrontmatterProperty {
	id: number;
	key: string;
	value: string;
	isExisting: boolean;
	markedForDeletion: boolean;
	originalKey: string;
	originalValue: string;
}

type IdGenerator = () => number;

function createIdGenerator(): IdGenerator {
	let next = 0;
	return () => next++;
}

function createProperty(nextId: IdGenerator, key: string, value: string, isExisting: boolean): FrontmatterProperty {
	return {
		id: nextId(),
		key,
		value,
		isExisting,
		markedForDeletion: false,
		originalKey: key,
		originalValue: value,
	};
}

function buildPropertyMap(properties: FrontmatterProperty[]): Map<string, string | null> {
	const result = new Map<string, string | null>();

	for (const prop of properties) {
		const key = prop.key.trim();
		if (!key) continue;

		if (prop.markedForDeletion) {
			result.set(key, null);
		} else if (prop.isExisting) {
			const value = prop.value.trim();
			const keyChanged = key !== prop.originalKey;
			const valueChanged = value !== prop.originalValue.trim();

			if (keyChanged || valueChanged) {
				if (keyChanged && prop.originalKey.trim()) {
					result.set(prop.originalKey.trim(), null);
				}
				if (value) {
					result.set(key, value);
				}
			}
		} else {
			result.set(key, prop.value.trim());
		}
	}

	return result;
}

const PropertyRow = memo(function PropertyRow({
	property,
	onUpdate,
	onRemove,
}: {
	property: FrontmatterProperty;
	onUpdate: (id: number, updates: Partial<FrontmatterProperty>) => void;
	onRemove: (id: number) => void;
}) {
	const rowClass = [
		"prisma-batch-frontmatter-row",
		property.isExisting ? "prisma-batch-frontmatter-existing" : "",
		property.markedForDeletion ? "prisma-batch-frontmatter-marked-deletion" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={rowClass} data-testid="prisma-batch-property-row">
			<input
				type="text"
				placeholder="Property name"
				value={property.key}
				className="prisma-setting-item-control prisma-batch-frontmatter-key"
				onChange={(e) => {
					onUpdate(property.id, { key: e.target.value });
				}}
				disabled={property.markedForDeletion}
				data-testid="prisma-batch-property-key"
			/>
			<input
				type="text"
				placeholder="Value"
				value={property.value}
				className="prisma-setting-item-control prisma-batch-frontmatter-value"
				onChange={(e) => {
					onUpdate(property.id, { value: e.target.value });
				}}
				disabled={property.markedForDeletion}
				data-testid="prisma-batch-property-value"
			/>
			<button
				type="button"
				className="prisma-batch-frontmatter-remove-button"
				onClick={() => onRemove(property.id)}
				data-testid="prisma-batch-property-remove"
			>
				✕
			</button>
		</div>
	);
});

interface BatchFrontmatterFormProps {
	app: App;
	settings: SingleCalendarConfig;
	selectedEvents: CalendarEvent[];
	onSubmit: (properties: Map<string, string | null>) => void;
	onCancel: () => void;
}

export function BatchFrontmatterForm({ app, settings, selectedEvents, onSubmit, onCancel }: BatchFrontmatterFormProps) {
	const [nextId] = useState(createIdGenerator);

	const [properties, setProperties] = useState<FrontmatterProperty[]>(() => {
		const existing = getAllFrontmatterProperties(app, selectedEvents, settings);
		const initial: FrontmatterProperty[] = [];
		if (existing.size === 0) {
			initial.push(createProperty(nextId, "", "", false));
		} else {
			for (const [k, v] of existing.entries()) {
				initial.push(createProperty(nextId, k, v, true));
			}
			initial.push(createProperty(nextId, "", "", false));
		}
		return initial;
	});

	const addProperty = useCallback(
		() => setProperties((prev) => [...prev, createProperty(nextId, "", "", false)]),
		[nextId]
	);

	const updateProperty = useCallback((id: number, updates: Partial<FrontmatterProperty>) => {
		setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
	}, []);

	const removeProperty = useCallback((id: number) => {
		setProperties((prev) => {
			const prop = prev.find((p) => p.id === id);
			if (!prop) return prev;

			if (prop.isExisting) {
				return prev.map((p) => (p.id === id ? { ...p, markedForDeletion: !p.markedForDeletion } : p));
			}
			return prev.filter((p) => p.id !== id);
		});
	}, []);

	const handleSubmit = useCallback(() => onSubmit(buildPropertyMap(properties)), [properties, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel} submitLabel="Apply changes">
			<h2>Batch frontmatter management</h2>
			<ModalDescription>Add, update, or delete frontmatter properties across all selected events.</ModalDescription>

			<div className="prisma-setting-item">
				<div className="prisma-setting-item-name">
					<div className="prisma-setting-item-heading">Properties</div>
				</div>
				<button type="button" className="prisma-mod-cta" onClick={addProperty} data-testid="prisma-batch-add-property">
					Add property
				</button>
			</div>

			<div className="prisma-batch-frontmatter-header-row">
				<div className="prisma-batch-frontmatter-header-label">Property name</div>
				<div className="prisma-batch-frontmatter-header-label">Value</div>
			</div>

			<div className="prisma-batch-frontmatter-container">
				{properties.map((prop) => (
					<PropertyRow key={prop.id} property={prop} onUpdate={updateProperty} onRemove={removeProperty} />
				))}
			</div>
		</ModalForm>
	);
}

export function openBatchFrontmatterModal(
	app: App,
	settings: SingleCalendarConfig,
	selectedEvents: CalendarEvent[]
): Promise<Map<string, string | null> | null> {
	return openReactModal<Map<string, string | null>>({
		app,
		cls: "prisma-batch-frontmatter-modal",
		testId: "prisma-modal-batch-frontmatter",
		render: (submit, cancel) => (
			<BatchFrontmatterForm
				app={app}
				settings={settings}
				selectedEvents={selectedEvents}
				onSubmit={submit}
				onCancel={cancel}
			/>
		),
	});
}
