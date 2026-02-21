import { cls, MountableView } from "@real1ty-obsidian-plugins";
import { Component, ItemView, MarkdownRenderer, Notice, type WorkspaceLeaf } from "obsidian";
import { AIChatManager, type ChatMessage } from "../core/ai";
import { buildCalendarContext, getViewLabel, type CalendarContext } from "../core/ai/ai-context-builder";
import type CustomCalendarPlugin from "../main";
import { CalendarView, getCalendarViewType } from "./calendar-view";

export const AI_CHAT_VIEW_TYPE = "prisma-ai-chat";

export class AIChatView extends MountableView(ItemView, "prisma") {
	private chatManager: AIChatManager;
	private messagesContainerEl!: HTMLElement;
	private chipsContainerEl!: HTMLElement;
	private contextBadgeEl!: HTMLElement;
	private textareaEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private isLoading = false;
	private markdownComponent = new Component();
	private selectedPromptIds = new Set<string>();

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CustomCalendarPlugin
	) {
		super(leaf);
		this.chatManager = new AIChatManager(this.plugin.settingsStore);
	}

	getViewType(): string {
		return AI_CHAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Prisma AI";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		this.markdownComponent.load();
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass(cls("ai-chat-container"));

		this.buildUI(container);
		this.renderMessages();
		this.refreshContextBadge();

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.refreshContextBadge();
			})
		);
	}

	async onClose(): Promise<void> {
		this.markdownComponent.unload();
		this.chatManager.clearHistory();
	}

	private buildUI(container: HTMLElement): void {
		// Messages area
		this.messagesContainerEl = container.createDiv({ cls: cls("ai-chat-messages") });

		// Input area
		const inputArea = container.createDiv({ cls: cls("ai-chat-input-area") });

		// Context badge
		this.contextBadgeEl = inputArea.createDiv({ cls: cls("ai-chat-context-badge") });

		// Custom prompt chips
		this.chipsContainerEl = inputArea.createDiv({ cls: cls("ai-chat-chips") });
		this.renderPromptChips();

		this.textareaEl = inputArea.createEl("textarea", {
			cls: cls("ai-chat-textarea"),
			attr: { placeholder: "Ask about your calendar...", rows: "3" },
		});

		this.textareaEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.handleSend();
			}
		});

		const btnRow = inputArea.createDiv({ cls: cls("ai-chat-btn-row") });

		const clearBtn = btnRow.createEl("button", {
			cls: cls("ai-chat-clear-btn"),
			text: "Clear",
		});
		clearBtn.addEventListener("click", () => {
			this.chatManager.clearHistory();
			this.renderMessages();
		});

		this.sendBtnEl = btnRow.createEl("button", {
			cls: cls("ai-chat-send-btn"),
			text: "Send",
		});
		this.sendBtnEl.addEventListener("click", () => {
			void this.handleSend();
		});
	}

	private renderPromptChips(): void {
		this.chipsContainerEl.empty();
		const customPrompts = this.plugin.settingsStore.currentSettings.ai.customPrompts;
		if (customPrompts.length === 0) {
			this.chipsContainerEl.hide();
			return;
		}
		this.chipsContainerEl.show();

		for (const prompt of customPrompts) {
			const isActive = this.selectedPromptIds.has(prompt.id);
			const chip = this.chipsContainerEl.createEl("button", {
				text: prompt.title,
				cls: `${cls("ai-chat-chip")}${isActive ? ` ${cls("ai-chat-chip-active")}` : ""}`,
			});
			chip.addEventListener("click", () => {
				if (this.selectedPromptIds.has(prompt.id)) {
					this.selectedPromptIds.delete(prompt.id);
					chip.removeClass(cls("ai-chat-chip-active"));
				} else {
					this.selectedPromptIds.add(prompt.id);
					chip.addClass(cls("ai-chat-chip-active"));
				}
			});
		}
	}

	private async handleSend(): Promise<void> {
		const message = this.textareaEl.value.trim();
		if (!message || this.isLoading) return;

		this.textareaEl.value = "";
		this.setLoading(true);

		// Show user message immediately
		this.appendMessage({ role: "user", content: message });

		try {
			const allPrompts = this.plugin.settingsStore.currentSettings.ai.customPrompts;
			const selectedPrompts = allPrompts.filter((p) => this.selectedPromptIds.has(p.id));
			const calendarContext = await this.gatherCalendarContext();
			this.refreshContextBadge();
			await this.chatManager.sendMessage(message, selectedPrompts, calendarContext ?? undefined);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
			new Notice(`Prisma AI: ${errorMessage}`);
		} finally {
			this.setLoading(false);
			this.renderMessages();
		}
	}

	private async gatherCalendarContext(): Promise<CalendarContext | null> {
		const lastUsedCalendarId = this.plugin.syncStore.data.lastUsedCalendarId;
		if (!lastUsedCalendarId) return null;

		const bundle = this.plugin.calendarBundles.find((b) => b.calendarId === lastUsedCalendarId);
		if (!bundle) return null;

		const viewType = getCalendarViewType(lastUsedCalendarId);
		const leaves = this.app.workspace.getLeavesOfType(viewType);

		for (const leaf of leaves) {
			const view = leaf.view;
			if (!(view instanceof CalendarView)) continue;

			const viewContext = view.getViewContext();
			if (!viewContext) continue;

			const start = viewContext.currentStart.toISOString();
			const end = viewContext.currentEnd.toISOString();
			const events = await bundle.eventStore.getEvents({ start, end });
			const calendarName = bundle.settingsStore.currentSettings.name;
			const categoryProp = bundle.settingsStore.currentSettings.categoryProp;

			return buildCalendarContext(
				calendarName,
				viewContext.viewType,
				viewContext.currentStart,
				viewContext.currentEnd,
				events,
				categoryProp
			);
		}

		return null;
	}

	private refreshContextBadge(): void {
		const info = this.getActiveCalendarInfo();
		if (info) {
			this.contextBadgeEl.setText(`${info.calendarName} · ${info.viewLabel}`);
		} else {
			this.contextBadgeEl.setText("No calendar open");
		}
		this.contextBadgeEl.show();
	}

	private getActiveCalendarInfo(): { calendarName: string; viewLabel: string } | null {
		const lastUsedCalendarId = this.plugin.syncStore.data.lastUsedCalendarId;
		if (!lastUsedCalendarId) return null;

		const bundle = this.plugin.calendarBundles.find((b) => b.calendarId === lastUsedCalendarId);
		if (!bundle) return null;

		const viewType = getCalendarViewType(lastUsedCalendarId);
		const leaves = this.app.workspace.getLeavesOfType(viewType);

		for (const leaf of leaves) {
			const view = leaf.view;
			if (!(view instanceof CalendarView)) continue;

			const viewContext = view.getViewContext();
			if (!viewContext) continue;

			return {
				calendarName: bundle.settingsStore.currentSettings.name,
				viewLabel: getViewLabel(viewContext.viewType),
			};
		}

		return null;
	}

	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.sendBtnEl.disabled = loading;
		this.textareaEl.disabled = loading;

		if (loading) {
			this.sendBtnEl.setText("...");
		} else {
			this.sendBtnEl.setText("Send");
		}
	}

	private appendMessage(msg: ChatMessage): void {
		// Remove empty state if present
		const emptyEl = this.messagesContainerEl.querySelector(`.${cls("ai-chat-empty")}`);
		if (emptyEl) emptyEl.remove();

		this.renderMessage(msg);
		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	private renderMessages(): void {
		this.messagesContainerEl.empty();
		this.markdownComponent.unload();
		this.markdownComponent = new Component();
		this.markdownComponent.load();

		const messages = this.chatManager.getMessages();

		if (messages.length === 0) {
			this.messagesContainerEl.createDiv({
				cls: cls("ai-chat-empty"),
				text: "Ask anything about your calendar. Conversations reset when you close this panel.",
			});
			return;
		}

		for (const msg of messages) {
			this.renderMessage(msg);
		}

		// Scroll to bottom
		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	private renderMessage(msg: ChatMessage): void {
		const roleCls = msg.role === "user" ? cls("ai-chat-message-user") : cls("ai-chat-message-assistant");
		const messageEl = this.messagesContainerEl.createDiv({
			cls: `${cls("ai-chat-message")} ${roleCls}`,
		});

		if (msg.role === "user") {
			messageEl.createDiv({ cls: cls("ai-chat-message-content"), text: msg.content });
		} else {
			const contentEl = messageEl.createDiv({ cls: cls("ai-chat-message-content") });
			void MarkdownRenderer.render(this.app, msg.content, contentEl, "", this.markdownComponent);
		}
	}
}
