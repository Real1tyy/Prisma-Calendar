import { cls, MountableView, renderCollapsibleSection } from "@real1ty-obsidian-plugins";
import { Component, ItemView, MarkdownRenderer, Notice, type WorkspaceLeaf } from "obsidian";
import { distinctUntilChanged, skip } from "rxjs";

import { AIChatManager, type ChatMessage, ChatStore } from "../core/ai";
import { type CategoryContext, type ManipulationContext, type PlanningContext } from "../core/ai/ai-context-builder";
import {
	executeOperations,
	gatherCalendarContext,
	gatherCategoryContext,
	gatherManipulationContext,
	gatherPlanningContext,
	getActiveCalendarInfo,
	parseOperations,
	resolveActiveViewContext,
} from "../core/ai/ai-engine";
import { type SemanticValidationContext, validateOperationsSemantically } from "../core/ai/ai-validation";
import type { CalendarBundle } from "../core/calendar-bundle";
import { PRO_FEATURES } from "../core/license";
import type CustomCalendarPlugin from "../main";
import { AI_DEFAULTS } from "../types/ai";
import type { AIOperation } from "../types/ai-operation-schemas";
import { renderProUpgradeBanner } from "./settings/pro-upgrade-banner";

type AIMode = "query" | "manipulation" | "planning";

interface RetryResult<T> {
	response: T;
	exhaustedRetries: boolean;
}

async function withValidationRetries<T>(
	maxRetries: number,
	sendFn: (message: string, isRetry: boolean) => Promise<T>,
	validateFn: (response: T) => string[],
	initialMessage: string
): Promise<RetryResult<T>> {
	let currentMessage = initialMessage;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const response = await sendFn(currentMessage, attempt > 0);

		const errors = validateFn(response);
		if (errors.length === 0) {
			return { response, exhaustedRetries: false };
		}

		if (attempt < maxRetries) {
			console.warn(
				`[Prisma AI] Validation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying. Errors:\n`,
				errors.join("\n")
			);
			currentMessage =
				"Your response had validation errors:\n" +
				errors.join("\n") +
				"\n\nFix these issues and respond with a corrected JSON array of operations.";
			continue;
		}

		console.error(
			`[Prisma AI] Validation still failing after ${maxRetries} retries. Remaining errors:\n`,
			errors.join("\n")
		);
		return { response, exhaustedRetries: true };
	}

	throw new Error("Unreachable: retry loop exited without returning");
}

export const AI_CHAT_VIEW_TYPE = "prisma-ai-chat";

export class AIChatView extends MountableView(ItemView, "prisma") {
	private chatManager: AIChatManager;
	private chatStore: ChatStore;
	private messagesContainerEl!: HTMLElement;
	private chipsContainerEl!: HTMLElement;
	private contextBadgeEl!: HTMLElement;
	private modeToggleEl!: HTMLElement;
	private textareaEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private threadListContentEl!: HTMLElement;
	private isLoading = false;
	private markdownComponent = new Component();
	private selectedPromptIds = new Set<string>();
	private pendingOperations: AIOperation[] = [];
	private currentMode: AIMode = "query";
	private threadSearchQuery = "";

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CustomCalendarPlugin
	) {
		super(leaf);
		this.chatStore = new ChatStore(this.app, this.plugin);
		this.chatManager = new AIChatManager(this.plugin.settingsStore, this.chatStore);
	}

	getViewType(): string {
		return AI_CHAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Prisma AI";
	}

	override getIcon(): string {
		return "bot";
	}

	override async mount(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;

		if (!this.plugin.isProEnabled) {
			container.empty();
			renderProUpgradeBanner(
				container,
				PRO_FEATURES.AI_CHAT,
				"AI chat with Claude and GPT, including query, manipulation, and planning modes. Leverage AI to automate events creations, updates and deletions.",
				"AI_CHAT"
			);

			const sub = this.plugin.licenseManager.isPro$.pipe(skip(1), distinctUntilChanged()).subscribe((isPro) => {
				if (isPro) {
					sub.unsubscribe();
					void this.mountProContent(container);
				}
			});
			this.register(() => sub.unsubscribe());
			return;
		}

		await this.mountProContent(container);
	}

	private async mountProContent(container: HTMLElement): Promise<void> {
		this.markdownComponent.load();
		await this.chatManager.initialize();

		const currentThread = this.chatManager.getCurrentThread();
		if (currentThread) {
			this.currentMode = currentThread.mode as AIMode;
		}

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

	override async unmount(): Promise<void> {
		this.markdownComponent.unload();
		await this.chatManager.saveCurrentThread();
	}

	private setMode(mode: AIMode): void {
		this.currentMode = mode;
		this.chatManager.setMode(mode);
		this.pendingOperations = [];
		this.renderMessages();
		this.updateModeToggle();
		this.refreshContextBadge();
	}

	private buildUI(container: HTMLElement): void {
		this.buildThreadList(container);

		this.messagesContainerEl = container.createDiv({ cls: cls("ai-chat-messages") });

		const inputArea = container.createDiv({ cls: cls("ai-chat-input-area") });

		this.contextBadgeEl = inputArea.createDiv({ cls: cls("ai-chat-context-badge") });

		this.modeToggleEl = inputArea.createDiv({ cls: cls("ai-chat-mode-toggle") });
		this.chipsContainerEl = this.modeToggleEl;
		this.buildModeToggle();

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
			void this.chatManager.startNewThread(this.currentMode);
			this.pendingOperations = [];
			this.renderMessages();
			this.renderThreadList();
		});

		this.sendBtnEl = btnRow.createEl("button", {
			cls: cls("ai-chat-send-btn"),
			text: "Send",
		});
		this.sendBtnEl.addEventListener("click", () => {
			void this.handleSend();
		});
	}

	private buildThreadList(container: HTMLElement): void {
		const wrapper = container.createDiv({ cls: cls("ai-chat-thread-list") });

		renderCollapsibleSection(wrapper, {
			cssPrefix: "prisma-",
			label: "Conversations",
			startCollapsed: true,
			renderBody: (body) => {
				this.threadListContentEl = body;
			},
			renderHeaderActions: (header) => {
				const newBtn = header.createEl("button", {
					cls: cls("ai-chat-thread-new-btn"),
					text: "+",
					attr: { "aria-label": "New conversation" },
				});
				newBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.chatManager.startNewThread(this.currentMode);
					this.pendingOperations = [];
					this.renderMessages();
					this.renderThreadList();
				});
			},
		});

		this.renderThreadList();
	}

	private renderThreadList(): void {
		this.threadListContentEl.empty();

		const searchInput = this.threadListContentEl.createEl("input", {
			cls: cls("ai-chat-thread-search"),
			attr: { type: "text", placeholder: "Search conversations..." },
		});
		searchInput.value = this.threadSearchQuery;
		searchInput.addEventListener("input", () => {
			this.threadSearchQuery = searchInput.value;
			this.renderThreadItems();
		});

		this.renderThreadItems();
	}

	private renderThreadItems(): void {
		const existingItems = this.threadListContentEl.querySelectorAll(`.${cls("ai-chat-thread-item")}`);
		existingItems.forEach((el) => el.remove());

		const currentThread = this.chatManager.getCurrentThread();
		let threads = this.chatManager.getThreadList();

		if (this.threadSearchQuery) {
			const query = this.threadSearchQuery.toLowerCase();
			threads = threads.filter((t) => t.title.toLowerCase().includes(query));
		}

		for (const thread of threads) {
			const itemEl = this.threadListContentEl.createDiv({ cls: cls("ai-chat-thread-item") });

			if (currentThread && thread.id === currentThread.id) {
				itemEl.addClass(cls("ai-chat-thread-item-active"));
			}

			const infoEl = itemEl.createDiv({ cls: cls("ai-chat-thread-item-info") });
			infoEl.createDiv({ cls: cls("ai-chat-thread-item-title"), text: thread.title });
			infoEl.createDiv({
				cls: cls("ai-chat-thread-item-time"),
				text: this.formatRelativeTime(thread.updatedAt),
			});

			infoEl.addEventListener("click", () => {
				void this.onThreadSelect(thread.id);
			});

			const deleteBtn = itemEl.createEl("button", {
				cls: cls("ai-chat-thread-delete-btn"),
				text: "×",
				attr: { "aria-label": "Delete conversation" },
			});
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.onThreadDelete(thread.id);
			});
		}
	}

	private async onThreadSelect(id: string): Promise<void> {
		await this.chatManager.loadThread(id);
		const thread = this.chatManager.getCurrentThread();
		if (thread) {
			this.currentMode = thread.mode as AIMode;
			this.pendingOperations = [];
			this.renderMessages();
			this.updateModeToggle();
			this.refreshContextBadge();
			this.renderThreadList();
		}
	}

	private async onThreadDelete(id: string): Promise<void> {
		await this.chatManager.deleteThread(id);
		this.pendingOperations = [];
		this.renderMessages();
		this.renderThreadList();
	}

	private formatRelativeTime(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	private renderPromptChips(): void {
		const customPrompts = this.plugin.settingsStore.currentSettings.ai.customPrompts;
		if (customPrompts.length === 0) return;

		this.chipsContainerEl.createDiv({ cls: cls("ai-chat-chips-separator") });

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

		const modeGroup = this.modeToggleEl.createDiv({ cls: cls("ai-chat-mode-group") });

		const queryBtn = modeGroup.createEl("button", {
			text: "Query",
			cls: `${cls("ai-chat-mode-btn")}${this.currentMode === "query" ? ` ${cls("ai-chat-mode-active")}` : ""}`,
		});
		queryBtn.addEventListener("click", () => {
			if (this.currentMode !== "query") this.setMode("query");
		});

		const manipulateBtn = modeGroup.createEl("button", {
			text: "Manipulate",
			cls: `${cls("ai-chat-mode-btn")}${this.currentMode === "manipulation" ? ` ${cls("ai-chat-mode-active")}` : ""}`,
		});
		manipulateBtn.addEventListener("click", () => {
			if (this.currentMode !== "manipulation") this.setMode("manipulation");
		});

		const planBtn = modeGroup.createEl("button", {
			text: "Plan",
			cls: `${cls("ai-chat-mode-btn")}${this.currentMode === "planning" ? ` ${cls("ai-chat-mode-active")}` : ""}`,
		});
		planBtn.addEventListener("click", () => {
			if (this.currentMode !== "planning") this.setMode("planning");
		});

		this.renderPromptChips();
	}

	private updateModeToggle(): void {
		this.buildModeToggle();
	}

	private resolveBundle(): CalendarBundle | null {
		const lastUsedCalendarId = this.plugin.syncStore.data.lastUsedCalendarId;
		if (!lastUsedCalendarId) return null;
		return this.plugin.calendarBundles.find((b) => b.calendarId === lastUsedCalendarId) ?? null;
	}

	private async handleSend(): Promise<void> {
		const message = this.textareaEl.value.trim();
		if (!message || this.isLoading) return;

		this.textareaEl.value = "";
		this.setLoading(true);

		this.appendMessage({ role: "user", content: message });

		try {
			const bundle = this.resolveBundle();
			const viewContext = bundle ? resolveActiveViewContext(this.plugin, bundle) : null;

			const allPrompts = this.plugin.settingsStore.currentSettings.ai.customPrompts;
			const selectedPrompts = allPrompts.filter((p) => this.selectedPromptIds.has(p.id));
			const categoryContext = bundle ? gatherCategoryContext(bundle) : null;

			if (this.currentMode === "planning") {
				const planningContext = bundle && viewContext ? await gatherPlanningContext(bundle, viewContext) : null;
				this.refreshContextBadge();
				await this.handleOperationModeWithRetries(
					message,
					selectedPrompts,
					categoryContext,
					undefined,
					planningContext ?? undefined
				);
			} else if (this.currentMode === "manipulation") {
				const manipulationContext = bundle && viewContext ? await gatherManipulationContext(bundle, viewContext) : null;
				this.refreshContextBadge();
				await this.handleOperationModeWithRetries(
					message,
					selectedPrompts,
					categoryContext,
					manipulationContext ?? undefined,
					undefined
				);
			} else {
				const calendarContext = bundle && viewContext ? await gatherCalendarContext(bundle, viewContext) : null;
				this.refreshContextBadge();
				await this.chatManager.sendMessage(
					message,
					selectedPrompts,
					calendarContext ?? undefined,
					undefined,
					undefined,
					categoryContext ?? undefined
				);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
			new Notice(`Prisma AI: ${errorMessage}`);
		} finally {
			this.setLoading(false);
			this.renderMessages();
			this.renderThreadList();
		}
	}

	private async handleOperationModeWithRetries(
		userMessage: string,
		selectedPrompts: Array<{ title: string; content: string }>,
		categoryContext: CategoryContext | null,
		manipulationContext?: ManipulationContext,
		planningContext?: PlanningContext
	): Promise<void> {
		const aiSettings = this.plugin.settingsStore.currentSettings.ai;
		const validationContext: SemanticValidationContext = {
			mode: this.currentMode,
			currentEvents: planningContext?.currentEvents ?? manipulationContext?.events,
			intervalStart: planningContext?.currentStart,
			intervalEnd: planningContext?.currentEnd,
			gapDetection: aiSettings.aiPlanningGapDetection,
			dayCoverage: aiSettings.aiPlanningDayCoverage,
		};

		const planningPromptFlags = planningContext
			? { gapDetection: aiSettings.aiPlanningGapDetection, dayCoverage: aiSettings.aiPlanningDayCoverage }
			: undefined;

		const result = await withValidationRetries(
			AI_DEFAULTS.MAX_REPROMPT_RETRIES,
			(message, isRetry) =>
				this.chatManager.sendMessage(
					message,
					isRetry ? undefined : selectedPrompts,
					undefined,
					manipulationContext,
					planningContext,
					categoryContext ?? undefined,
					planningPromptFlags
				),
			(response) => {
				const operations = parseOperations(response);
				if (!operations) return [];
				return validateOperationsSemantically(operations, validationContext);
			},
			userMessage
		);

		if (result.exhaustedRetries) {
			new Notice(
				`Prisma AI: Validation issues remain after ${AI_DEFAULTS.MAX_REPROMPT_RETRIES} retries. Review carefully.`
			);
		}
		this.handleManipulationResponse(result.response);
	}

	private handleManipulationResponse(response: string): void {
		const operations = parseOperations(response);
		if (!operations) return;

		const confirmExecution = this.plugin.settingsStore.currentSettings.ai.aiConfirmExecution;
		if (confirmExecution) {
			this.pendingOperations = operations;
		} else {
			void this.handleExecuteOperations(operations);
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
			void this.handleExecuteOperations(operations, executeBtn);
		});
	}

	private async handleExecuteOperations(operations: AIOperation[], executeBtn?: HTMLButtonElement): Promise<void> {
		if (executeBtn) {
			executeBtn.disabled = true;
			executeBtn.setText("Executing...");
		}

		const result = await executeOperations(this.plugin, operations);

		const summary =
			result.failed > 0
				? `${result.succeeded} succeeded, ${result.failed} failed`
				: `${result.succeeded} operation${result.succeeded !== 1 ? "s" : ""} executed successfully`;

		new Notice(`Prisma AI: ${summary}`);
		if (executeBtn) executeBtn.setText(summary);
		this.pendingOperations = [];

		this.appendMessage({ role: "assistant", content: `**Execution complete:** ${summary}` });
	}

	private refreshContextBadge(): void {
		const info = getActiveCalendarInfo(this.plugin);
		if (info) {
			this.contextBadgeEl.setText(`${info.calendarName} · ${info.viewLabel}`);
		} else {
			this.contextBadgeEl.setText("No calendar open");
		}
		this.contextBadgeEl.show();
	}

	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.sendBtnEl.disabled = loading;
		this.textareaEl.disabled = loading;

		if (loading) {
			this.sendBtnEl.setText("...");
			this.showThinkingIndicator();
		} else {
			this.sendBtnEl.setText("Send");
			this.removeThinkingIndicator();
		}
	}

	private showThinkingIndicator(): void {
		this.removeThinkingIndicator();
		const indicator = this.messagesContainerEl.createDiv({
			cls: `${cls("ai-chat-message")} ${cls("ai-chat-message-assistant")} ${cls("ai-chat-thinking")}`,
		});
		const dots = indicator.createDiv({ cls: cls("ai-chat-thinking-dots") });
		dots.createSpan();
		dots.createSpan();
		dots.createSpan();
		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	private removeThinkingIndicator(): void {
		const el = this.messagesContainerEl.querySelector(`.${cls("ai-chat-thinking")}`);
		if (el) el.remove();
	}

	private appendMessage(msg: ChatMessage): void {
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
				text: "Ask anything about your calendar. Your conversations are saved automatically.",
			});
			return;
		}

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

		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	private renderMessage(msg: ChatMessage, isLastAssistant = false): void {
		const roleCls = msg.role === "user" ? cls("ai-chat-message-user") : cls("ai-chat-message-assistant");
		const messageEl = this.messagesContainerEl.createDiv({
			cls: `${cls("ai-chat-message")} ${roleCls}`,
		});

		if (msg.role === "user") {
			messageEl.createDiv({ cls: cls("ai-chat-message-content"), text: msg.content });
		} else if (
			(this.currentMode === "manipulation" || this.currentMode === "planning") &&
			isLastAssistant &&
			this.pendingOperations.length > 0
		) {
			this.renderOperationCards(this.pendingOperations, messageEl);
		} else {
			const contentEl = messageEl.createDiv({ cls: cls("ai-chat-message-content") });
			void MarkdownRenderer.render(this.app, msg.content, contentEl, "", this.markdownComponent);
		}
	}
}
