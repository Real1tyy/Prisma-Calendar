import { AI_DEFAULTS } from "./ai-constants";
import type { AIProvider } from "./ai-constants";
import {
	buildManipulationSystemPrompt,
	buildPlanningSystemPrompt,
	buildSystemPromptWithContext,
	NO_CONTEXT_PROMPT_SUFFIX,
	type CalendarContext,
	type ManipulationContext,
	type PlanningContext,
} from "./ai-context-builder";
import { AIServiceError, callAI, type ChatMessage, type ThreadData } from "./ai-service";
import type { ChatStore } from "./chat-store";
import type { SettingsStore } from "../settings-store";

const BASE_SYSTEM_PROMPT = `You are an AI assistant integrated into Prisma Calendar, an Obsidian plugin for managing calendar events. You help users understand and manage their calendar data.
The user is viewing their calendar and asking about their events and schedule.

Be concise and helpful. Format responses using Markdown when appropriate.`;

const MAX_TITLE_LENGTH = 50;

export class AIChatManager {
	private currentThread: ThreadData | null = null;

	constructor(
		private settingsStore: SettingsStore,
		private chatStore: ChatStore
	) {}

	async initialize(): Promise<void> {
		await this.chatStore.ensureDir();
		await this.chatStore.loadIndex();

		const threads = this.chatStore.getThreadList();
		if (threads.length > 0) {
			this.currentThread = await this.chatStore.loadThread(threads[0].id);
		}
	}

	async sendMessage(
		userMessage: string,
		customPrompts?: Array<{ title: string; content: string }>,
		calendarContext?: CalendarContext,
		manipulationContext?: ManipulationContext,
		planningContext?: PlanningContext
	): Promise<string> {
		const { model, provider, apiKey } = this.resolveAIConfig();

		if (!this.currentThread) {
			this.currentThread = this.chatStore.createThread("query");
		}

		this.chatStore.addMessage(this.currentThread, "user", userMessage);

		// Auto-generate title from first user message
		if (this.currentThread.messages.length === 1) {
			this.currentThread.title =
				userMessage.length > MAX_TITLE_LENGTH ? userMessage.slice(0, MAX_TITLE_LENGTH) + "…" : userMessage;
		}

		const messages: ChatMessage[] = this.currentThread.messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		let systemPrompt: string;
		if (planningContext) {
			systemPrompt = buildPlanningSystemPrompt(planningContext, BASE_SYSTEM_PROMPT);
		} else if (manipulationContext) {
			systemPrompt = buildManipulationSystemPrompt(manipulationContext, BASE_SYSTEM_PROMPT);
		} else if (calendarContext) {
			systemPrompt = buildSystemPromptWithContext(calendarContext, BASE_SYSTEM_PROMPT);
		} else {
			systemPrompt = BASE_SYSTEM_PROMPT + NO_CONTEXT_PROMPT_SUFFIX;
		}

		if (customPrompts && customPrompts.length > 0) {
			const contextBlock = customPrompts.map((p) => `### ${p.title}\n${p.content}`).join("\n\n");
			systemPrompt = `${systemPrompt}\n\n## Custom Context\n${contextBlock}`;
		}

		try {
			const response = await callAI(provider, apiKey, model, systemPrompt, messages);
			this.chatStore.addMessage(this.currentThread, "assistant", response);
			await this.chatStore.saveThread(this.currentThread);
			return response;
		} catch (error) {
			// Remove the user message on failure so it can be retried
			this.currentThread.messages.pop();
			if (error instanceof AIServiceError) {
				throw error;
			}
			throw new AIServiceError("Failed to get AI response. Please try again.");
		}
	}

	async startNewThread(mode: string): Promise<void> {
		this.currentThread = this.chatStore.createThread(mode);
	}

	async loadThread(id: string): Promise<void> {
		const thread = await this.chatStore.loadThread(id);
		if (thread) {
			this.currentThread = thread;
		}
	}

	async saveCurrentThread(): Promise<void> {
		if (this.currentThread && this.currentThread.messages.length > 0) {
			await this.chatStore.saveThread(this.currentThread);
		}
	}

	setMode(mode: string): void {
		if (this.currentThread) {
			this.currentThread.mode = mode;
			this.currentThread.updatedAt = new Date().toISOString();
		}
	}

	async deleteThread(id: string): Promise<void> {
		await this.chatStore.deleteThread(id);
		if (this.currentThread?.id === id) {
			this.currentThread = null;
		}
	}

	getThreadList() {
		return this.chatStore.getThreadList();
	}

	getCurrentThread(): ThreadData | null {
		return this.currentThread;
	}

	clearHistory(): void {
		if (this.currentThread) {
			this.currentThread.messages = [];
		}
	}

	getMessages(): ReadonlyArray<ChatMessage> {
		return this.currentThread?.messages ?? [];
	}

	private resolveAIConfig(): { model: string; provider: AIProvider; apiKey: string } {
		const settings = this.settingsStore.currentSettings;
		const model = settings.ai.aiModel || AI_DEFAULTS.DEFAULT_MODEL;
		const modelOption = AI_DEFAULTS.MODEL_OPTIONS[model];
		const provider: AIProvider = modelOption?.provider ?? "anthropic";

		const secretName =
			provider === "anthropic" ? settings.ai.anthropicApiKeySecretName : settings.ai.openaiApiKeySecretName;

		if (!secretName) {
			throw new AIServiceError(
				`No ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key configured. Go to Settings → AI to add one.`
			);
		}

		const apiKey = this.settingsStore.getSecret(secretName);
		if (!apiKey) {
			throw new AIServiceError(
				`API key secret "${secretName}" is empty. Check your ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key in Settings → AI.`
			);
		}

		return { model, provider, apiKey };
	}
}
