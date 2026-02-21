import { cls, MountableView } from "@real1ty-obsidian-plugins";
import { Component, ItemView, MarkdownRenderer, Notice, type WorkspaceLeaf } from "obsidian";
import { AIChatManager, type ChatMessage } from "../core/ai";
import type CustomCalendarPlugin from "../main";

export const AI_CHAT_VIEW_TYPE = "prisma-ai-chat";

export class AIChatView extends MountableView(ItemView, "prisma") {
	private chatManager: AIChatManager;
	private messagesContainerEl!: HTMLElement;
	private chipsContainerEl!: HTMLElement;
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

		try {
			const allPrompts = this.plugin.settingsStore.currentSettings.ai.customPrompts;
			const selectedPrompts = allPrompts.filter((p) => this.selectedPromptIds.has(p.id));
			await this.chatManager.sendMessage(message, selectedPrompts);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
			new Notice(`Prisma AI: ${errorMessage}`);
			// Re-render to show the user message that was already added before the error rolled it back
		} finally {
			this.setLoading(false);
			this.renderMessages();
		}
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
