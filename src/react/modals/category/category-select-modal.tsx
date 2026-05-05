import { ModalForm, openReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useCallback, useMemo, useState } from "react";

import type { CategoryInfo, CategoryTracker } from "../../../core/category-tracker";

interface CategorySelectFormProps {
	allCategories: CategoryInfo[];
	onSelect: (category: string) => void;
	onCancel: () => void;
}

const CategoryListItem = memo(function CategoryListItem({
	category,
	onSelect,
	selected,
}: {
	category: CategoryInfo;
	onSelect: (name: string) => void;
	selected: boolean;
}) {
	return (
		<div
			className={`prisma-category-list-item${selected ? " is-selected" : ""}`}
			onClick={() => onSelect(category.name)}
			data-testid={`prisma-category-item-${category.name}`}
		>
			<span
				className="prisma-category-color-dot"
				style={{ "--category-color": category.color } as React.CSSProperties}
			/>
			<span>{category.name}</span>
		</div>
	);
});

export function CategorySelectForm({ allCategories, onSelect, onCancel }: CategorySelectFormProps) {
	const [search, setSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const lower = search.toLowerCase();
		return allCategories.filter((cat) => cat.name.toLowerCase().includes(lower));
	}, [allCategories, search]);

	const handleConfirm = useCallback(() => {
		if (selectedCategory) onSelect(selectedCategory);
	}, [selectedCategory, onSelect]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const target = selectedCategory ?? filtered[0]?.name;
				if (target) onSelect(target);
			}
		},
		[filtered, selectedCategory, onSelect]
	);

	return (
		<ModalForm onSubmit={handleConfirm} onCancel={onCancel} submitLabel="Highlight" submitDisabled={!selectedCategory}>
			<h2>Highlight events with category</h2>
			<div className="prisma-category-select-form">
				<div className="prisma-category-select-section">
					<label>Select category</label>
					<input
						type="text"
						placeholder="Search categories..."
						className="prisma-category-search-input"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						onKeyDown={handleKeyDown}
						autoFocus
						data-testid="prisma-category-search"
					/>
					<div className="prisma-category-list">
						{filtered.length === 0 && (
							<div className="prisma-category-empty-message">
								{search ? "No matching categories" : "No categories yet"}
							</div>
						)}
						{filtered.map((cat) => (
							<CategoryListItem
								key={cat.name}
								category={cat}
								onSelect={setSelectedCategory}
								selected={cat.name === selectedCategory}
							/>
						))}
					</div>
				</div>

				<div className="prisma-category-select-info">
					<p>Select a category to temporarily highlight all events associated with it for 10 seconds.</p>
				</div>
			</div>
		</ModalForm>
	);
}

export function openCategorySelectModal(app: App, categoryTracker: CategoryTracker): Promise<string | null> {
	const allCategories = categoryTracker.getCategoriesWithColors();

	return openReactModal<string>({
		app,
		cls: "prisma-category-select-modal",
		testId: "prisma-modal-category-select",
		render: (submit, cancel) => (
			<CategorySelectForm allCategories={allCategories} onSelect={submit} onCancel={cancel} />
		),
	});
}
