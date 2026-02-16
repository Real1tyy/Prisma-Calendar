import { cls } from "@real1ty-obsidian-plugins";
import { type App, Component, MarkdownRenderer, Modal } from "obsidian";
import type { SingleCalendarConfig } from "../../types/settings";

export abstract class BaseBasesViewModal extends Modal {
	private component: Component;
	private markdownContainerEl: HTMLElement | null = null;

	constructor(
		app: App,
		protected settings: SingleCalendarConfig
	) {
		super(app);
		this.component = new Component();
	}

	onOpen(): void {
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

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
		this.markdownContainerEl = null;
	}

	private async renderBasesView(): Promise<void> {
		if (!this.markdownContainerEl) return;

		this.markdownContainerEl.empty();

		const basesMarkdown = this.buildBasesMarkdown();

		await MarkdownRenderer.render(this.app, basesMarkdown, this.markdownContainerEl, "", this.component);
	}

	protected getViewType(): string {
		return this.settings.basesViewType;
	}

	private buildBasesMarkdown(): string {
		const eventsFolder = this.settings.directory;
		const sortProp = this.settings.sortDateProp;
		const statusProp = this.settings.statusProperty;
		const basesViewProperties = this.settings.basesViewProperties;
		const nameColumn = this.settings.calendarTitleProp || "file.name";
		const orderProperties = [nameColumn, sortProp, statusProp, ...basesViewProperties].filter(Boolean);
		const filterLines = this.getFilterLines();

		return `\`\`\`base
views:
  - type: ${this.getViewType()}
    name: ${this.getViewName()}
    filters:
      and:
        - file.inFolder("${eventsFolder}")
${filterLines.map((line) => `        - ${line}`).join("\n")}
    order:
${orderProperties.map((prop) => `      - ${prop}`).join("\n")}
    columnSize:
      note.${sortProp}: 170
    sort:
      - property: ${sortProp}
        direction: DESC
\`\`\``;
	}

	protected abstract getTitle(): string;
	protected abstract getViewName(): string;
	protected abstract getFilterLines(): string[];
}
