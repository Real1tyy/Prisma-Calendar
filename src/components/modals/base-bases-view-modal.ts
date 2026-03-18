import {
	BaseBuilder,
	type BaseFilterNode,
	BaseRenderer,
	type BaseViewType,
	cls,
	ColumnRef,
	Filter,
} from "@real1ty-obsidian-plugins";
import { type App, Component, MarkdownRenderer, Modal } from "obsidian";

import type { SingleCalendarConfig } from "../../types/settings";

export abstract class BaseBasesViewModal extends Modal {
	private component: Component;
	private markdownContainerEl!: HTMLElement;

	constructor(
		app: App,
		protected settings: SingleCalendarConfig
	) {
		super(app);
		this.component = new Component();
	}

	override onOpen(): void {
		this.component.load();
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass(cls("category-modal"));

		contentEl.createEl("h2", { text: this.getTitle() });

		this.markdownContainerEl = contentEl.createDiv({
			cls: cls("bases-markdown-container"),
		});

		void this.renderBasesView();
	}

	override onClose(): void {
		this.component.unload();
		this.contentEl.empty();
	}

	private async renderBasesView(): Promise<void> {
		this.markdownContainerEl.empty();

		const basesMarkdown = this.buildBasesMarkdown();

		await MarkdownRenderer.render(this.app, basesMarkdown, this.markdownContainerEl, "", this.component);
	}

	protected getViewType(): BaseViewType {
		return this.settings.basesViewType as BaseViewType;
	}

	private buildBasesMarkdown(): string {
		const { directory, sortDateProp, statusProperty, basesViewProperties, calendarTitleProp } = this.settings;
		const nameColumn = calendarTitleProp || "file.name";

		const def = BaseBuilder.create()
			.addView({
				type: this.getViewType(),
				name: this.getViewName(),
				filter: Filter.and(Filter.inFolder(directory), ...this.getFilters()),
				order: [nameColumn, sortDateProp, statusProperty, ...basesViewProperties].filter(Boolean),
				sort: [{ property: sortDateProp, direction: "DESC" }],
				columnSize: { [ColumnRef.note(sortDateProp)]: 170 },
			})
			.build();

		return BaseRenderer.renderCodeBlock(def);
	}

	protected abstract getTitle(): string;
	protected abstract getViewName(): string;
	protected abstract getFilters(): BaseFilterNode[];
}
