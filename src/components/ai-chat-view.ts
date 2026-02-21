import { cls, MacroCommand, MountableView, type Command } from "@real1ty-obsidian-plugins";
import { Component, ItemView, MarkdownRenderer, Notice, type WorkspaceLeaf } from "obsidian";
import { AIChatManager, type ChatMessage } from "../core/ai";
import {
	buildCalendarContext,
	buildManipulationContext,
	getViewLabel,
	type CalendarContext,
	type ManipulationContext,
} from "../core/ai/ai-context-builder";
import type { CalendarBundle } from "../core/calendar-bundle";
import type CustomCalendarPlugin from "../main";
import { CalendarView, getCalendarViewType } from "./calendar-view";

type AIMode = "query" | "manipulation";

type AIOperation =
	| {
			type: "create";
			title: string;
			start: string;
			end: string;
			allDay?: boolean;
			categories?: string[];
			location?: string;
			participants?: string[];
	  }
	| {
			type: "edit";
			filePath: string;
			title?: string;
			start?: string;
			end?: string;
			allDay?: boolean;
			categories?: string[];
			location?: string;
			participants?: string[];
	  }
	| { type: "delete"; filePath: string };

export const AI_CHAT_VIEW_TYPE = "prisma-ai-chat";

export class AIChatView extends MountableView(ItemView, "prisma") {
	private chatManager: AIChatManager;
	private messagesContainerEl!: HTMLElement;
	private chipsContainerEl!: HTMLElement;
	private contextBadgeEl!: HTMLElement;
	private modeToggleEl!: HTMLElement;
	private textareaEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private isLoading = false;
	private markdownComponent = new Component();
	private selectedPromptIds = new Set<string>();
	private pendingOperations: AIOperation[] = [];
	private currentMode: AIMode = "query";

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

	private setMode(mode: AIMode): void {
		this.currentMode = mode;
		this.chatManager.clearHistory();
		this.pendingOperations = [];
		this.renderMessages();
		this.updateModeToggle();
		this.refreshContextBadge();
	}

	private buildUI(container: HTMLElement): void {
		// Messages area
		this.messagesContainerEl = container.createDiv({ cls: cls("ai-chat-messages") });

		// Input area
		const inputArea = container.createDiv({ cls: cls("ai-chat-input-area") });

		// Context badge
		this.contextBadgeEl = inputArea.createDiv({ cls: cls("ai-chat-context-badge") });

		// Mode toggle
		this.modeToggleEl = inputArea.createDiv({ cls: cls("ai-chat-mode-toggle") });
		this.buildModeToggle();

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

	private buildModeToggle(): void {
		this.modeToggleEl.empty();

		const queryBtn = this.modeToggleEl.createEl("button", {
			text: "Query",
			cls: `${cls("ai-chat-mode-btn")}${this.currentMode === "query" ? ` ${cls("ai-chat-mode-active")}` : ""}`,
		});
		queryBtn.addEventListener("click", () => {
			if (this.currentMode !== "query") this.setMode("query");
		});

		const manipulateBtn = this.modeToggleEl.createEl("button", {
			text: "Manipulate",
			cls: `${cls("ai-chat-mode-btn")}${this.currentMode === "manipulation" ? ` ${cls("ai-chat-mode-active")}` : ""}`,
		});
		manipulateBtn.addEventListener("click", () => {
			if (this.currentMode !== "manipulation") this.setMode("manipulation");
		});
	}

	private updateModeToggle(): void {
		this.buildModeToggle();
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

			if (this.currentMode === "manipulation") {
				const manipulationContext = await this.gatherManipulationContext();
				this.refreshContextBadge();
				const response = await this.chatManager.sendMessage(
					message,
					selectedPrompts,
					undefined,
					manipulationContext ?? undefined
				);
				this.handleManipulationResponse(response);
			} else {
				const calendarContext = await this.gatherCalendarContext();
				this.refreshContextBadge();
				await this.chatManager.sendMessage(message, selectedPrompts, calendarContext ?? undefined);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
			new Notice(`Prisma AI: ${errorMessage}`);
		} finally {
			this.setLoading(false);
			this.renderMessages();
		}
	}

	private async gatherManipulationContext(): Promise<ManipulationContext | null> {
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

			return buildManipulationContext(calendarName, viewContext.currentStart, viewContext.currentEnd, events);
		}

		return null;
	}

	private handleManipulationResponse(response: string): void {
		const operations = this.parseOperations(response);
		if (!operations) return;

		const confirmExecution = this.plugin.settingsStore.currentSettings.ai.aiConfirmExecution;
		if (confirmExecution) {
			this.pendingOperations = operations;
		} else {
			void this.executeOperations(operations);
		}
	}

	private parseOperations(response: string): AIOperation[] | null {
		// Try to extract JSON from markdown code block
		const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		const jsonStr = codeBlockMatch ? codeBlockMatch[1] : response.trim();

		try {
			const parsed = JSON.parse(jsonStr) as unknown;
			if (!Array.isArray(parsed)) return null;

			for (const op of parsed) {
				if (typeof op !== "object" || op === null) return null;
				const record = op as Record<string, unknown>;
				if (record.type === "create") {
					if (typeof record.title !== "string" || typeof record.start !== "string") return null;
				} else if (record.type === "edit") {
					if (typeof record.filePath !== "string") return null;
				} else if (record.type === "delete") {
					if (typeof record.filePath !== "string") return null;
				} else {
					return null;
				}
			}

			return parsed as AIOperation[];
		} catch {
			return null;
		}
	}

	private renderOperationCards(operations: AIOperation[], containerEl: HTMLElement): void {
		const opsWrapper = containerEl.createDiv({ cls: cls("ai-chat-operations") });

		for (const op of operations) {
			const card = opsWrapper.createDiv({ cls: cls("ai-chat-op-card") });

			if (op.type === "create") {
				card.addClass(cls("ai-chat-op-create"));
				card.createDiv({ cls: cls("ai-chat-op-badge"), text: "CREATE" });
				card.createDiv({ cls: cls("ai-chat-op-title"), text: op.title });
				card.createDiv({ cls: cls("ai-chat-op-detail"), text: `${op.start} → ${op.end}` });
				if (op.categories?.length) {
					card.createDiv({ cls: cls("ai-chat-op-detail"), text: `Categories: ${op.categories.join(", ")}` });
				}
			} else if (op.type === "edit") {
				card.addClass(cls("ai-chat-op-edit"));
				card.createDiv({ cls: cls("ai-chat-op-badge"), text: "EDIT" });
				card.createDiv({ cls: cls("ai-chat-op-detail"), text: op.filePath });
				const changes: string[] = [];
				if (op.title) changes.push(`Title: ${op.title}`);
				if (op.start) changes.push(`Start: ${op.start}`);
				if (op.end) changes.push(`End: ${op.end}`);
				if (op.categories) changes.push(`Categories: ${op.categories.join(", ")}`);
				if (op.location) changes.push(`Location: ${op.location}`);
				if (changes.length > 0) {
					card.createDiv({ cls: cls("ai-chat-op-detail"), text: changes.join(" · ") });
				}
			} else {
				card.addClass(cls("ai-chat-op-delete"));
				card.createDiv({ cls: cls("ai-chat-op-badge"), text: "DELETE" });
				card.createDiv({ cls: cls("ai-chat-op-detail"), text: op.filePath });
			}
		}

		const executeBtn = containerEl.createEl("button", {
			cls: cls("ai-chat-execute-btn"),
			text: `Execute All (${operations.length})`,
		});
		executeBtn.addEventListener("click", () => {
			void this.executeOperations(operations, executeBtn);
		});
	}

	private async executeOperations(operations: AIOperation[], executeBtn?: HTMLButtonElement): Promise<void> {
		if (executeBtn) {
			executeBtn.disabled = true;
			executeBtn.setText("Executing...");
		}

		const batchExecution = this.plugin.settingsStore.currentSettings.ai.aiBatchExecution;
		let summary: string;

		if (batchExecution) {
			summary = await this.executeBatch(operations);
		} else {
			summary = await this.executeIndividually(operations);
		}

		new Notice(`Prisma AI: ${summary}`);
		if (executeBtn) executeBtn.setText(summary);
		this.pendingOperations = [];

		this.chatManager.clearHistory();
		this.appendMessage({ role: "assistant", content: `**Execution complete:** ${summary}` });
	}

	private async executeBatch(operations: AIOperation[]): Promise<string> {
		const commands: Command[] = [];
		let bundle: CalendarBundle | null = null;
		let failed = 0;

		for (const op of operations) {
			const result = this.buildCommandForOperation(op);
			if (result) {
				commands.push(result.command);
				bundle = result.bundle;
			} else {
				failed++;
			}
		}

		if (commands.length > 0 && bundle) {
			try {
				const macro = new MacroCommand(commands);
				await bundle.commandManager.executeCommand(macro);
			} catch {
				return `Batch execution failed`;
			}
		}

		const succeeded = commands.length;
		return failed > 0
			? `${succeeded} succeeded, ${failed} failed`
			: `${succeeded} operation${succeeded !== 1 ? "s" : ""} executed successfully`;
	}

	private async executeIndividually(operations: AIOperation[]): Promise<string> {
		let succeeded = 0;
		let failed = 0;

		for (const op of operations) {
			try {
				const result = this.buildCommandForOperation(op);
				if (result) {
					await result.bundle.commandManager.executeCommand(result.command);
					succeeded++;
				} else {
					failed++;
				}
			} catch {
				failed++;
			}
		}

		return failed > 0
			? `${succeeded} succeeded, ${failed} failed`
			: `${succeeded} operation${succeeded !== 1 ? "s" : ""} executed successfully`;
	}

	private buildCommandForOperation(op: AIOperation): { command: Command; bundle: CalendarBundle } | null {
		if (op.type === "create") {
			return this.plugin.apiManager.buildCreateEventCommand({
				title: op.title,
				start: op.start,
				end: op.end,
				allDay: op.allDay,
				categories: op.categories,
				location: op.location,
				participants: op.participants,
			});
		} else if (op.type === "edit") {
			return this.plugin.apiManager.buildEditEventCommand({
				filePath: op.filePath,
				title: op.title,
				start: op.start,
				end: op.end,
				allDay: op.allDay,
				categories: op.categories,
				location: op.location,
				participants: op.participants,
			});
		} else {
			return this.plugin.apiManager.buildDeleteEventCommand({
				filePath: op.filePath,
			});
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

		// Find the last assistant message index
		let lastAssistantIdx = -1;
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "assistant") {
				lastAssistantIdx = i;
				break;
			}
		}

		for (let i = 0; i < messages.length; i++) {
			this.renderMessage(messages[i], i === lastAssistantIdx);
		}

		// Scroll to bottom
		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	private renderMessage(msg: ChatMessage, isLastAssistant = false): void {
		const roleCls = msg.role === "user" ? cls("ai-chat-message-user") : cls("ai-chat-message-assistant");
		const messageEl = this.messagesContainerEl.createDiv({
			cls: `${cls("ai-chat-message")} ${roleCls}`,
		});

		if (msg.role === "user") {
			messageEl.createDiv({ cls: cls("ai-chat-message-content"), text: msg.content });
		} else if (this.currentMode === "manipulation" && isLastAssistant && this.pendingOperations.length > 0) {
			// Render operation cards instead of raw JSON
			this.renderOperationCards(this.pendingOperations, messageEl);
		} else {
			const contentEl = messageEl.createDiv({ cls: cls("ai-chat-message-content") });
			void MarkdownRenderer.render(this.app, msg.content, contentEl, "", this.markdownComponent);
		}
	}
}
