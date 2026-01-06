import { cls } from "@real1ty-obsidian-plugins/utils";
import { type App, Component, MarkdownRenderer, Modal } from "obsidian";
import type { SingleCalendarConfig } from "../../types/settings";

export class CategoryEventsModal extends Modal {
	private component: Component;
	private markdownContainerEl: HTMLElement | null = null;

	constructor(
		app: App,
		private categoryName: string,
		private settings: SingleCalendarConfig
	) {
		super(app);
		this.component = new Component();
	}

	onOpen(): void {
		this.component.load();
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.addClass(cls("category-modal"));

		contentEl.createEl("h2", { text: `Category: ${this.categoryName}` });

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

	private buildBasesMarkdown(): string {
		const eventsFolder = this.settings.directory;
		const categoryProp = this.settings.categoryProp;
		const escapedCategory = this.categoryName.replace(/"/g, '\\"');
		const startProp = this.settings.startProp;
		const endProp = this.settings.endProp;
		const dateProp = this.settings.dateProp;
		const statusProp = this.settings.statusProperty;
		const basesViewProperties = this.settings.basesViewProperties || [];

		const orderProperties = ["file.name", dateProp, statusProp, ...basesViewProperties].filter(
			Boolean
		);

		return `\`\`\`base
views:
  - type: table
    name: ${this.categoryName}
    filters:
      and:
        - file.inFolder("${eventsFolder}")
        - ${categoryProp}.contains("${escapedCategory}")
    order:
${orderProperties.map((prop) => `      - ${prop}`).join("\n")}
	columnSize:
		note.${dateProp}: 170
		note.${startProp}: 170
		note.${endProp}: 170
    sort:
      - property: ${dateProp}
        direction: DESC
\`\`\``;
	}
}
