import { AI_DEFAULTS } from "./ai-constants";
import type { AIProvider } from "./ai-constants";
import { buildSystemPromptWithContext, NO_CONTEXT_PROMPT_SUFFIX, type CalendarContext } from "./ai-context-builder";
import { AIServiceError, callAI, type ChatMessage } from "./ai-service";
import type { SettingsStore } from "../settings-store";

const BASE_SYSTEM_PROMPT = `You are an AI assistant integrated into Prisma Calendar, an Obsidian plugin for managing calendar events. You help users understand and manage their calendar data.
The user is viewing their calendar and asking about their events and schedule.

Be concise and helpful. Format responses using Markdown when appropriate.`;

export class AIChatManager {
	private messages: ChatMessage[] = [];

	constructor(private settingsStore: SettingsStore) {}

	async sendMessage(
		userMessage: string,
		customPrompts?: Array<{ title: string; content: string }>,
		calendarContext?: CalendarContext
	): Promise<string> {
		const { model, provider, apiKey } = this.resolveAIConfig();

		this.messages.push({ role: "user", content: userMessage });

		let systemPrompt: string;
		if (calendarContext) {
			systemPrompt = buildSystemPromptWithContext(calendarContext, BASE_SYSTEM_PROMPT);
		} else {
			systemPrompt = BASE_SYSTEM_PROMPT + NO_CONTEXT_PROMPT_SUFFIX;
		}

		if (customPrompts && customPrompts.length > 0) {
			const contextBlock = customPrompts.map((p) => `### ${p.title}\n${p.content}`).join("\n\n");
			systemPrompt = `${systemPrompt}\n\n## Custom Context\n${contextBlock}`;
		}

		try {
			const response = await callAI(provider, apiKey, model, systemPrompt, this.messages);
			this.messages.push({ role: "assistant", content: response });
			return response;
		} catch (error) {
			// Remove the user message on failure so it can be retried
			this.messages.pop();
			if (error instanceof AIServiceError) {
				throw error;
			}
			throw new AIServiceError("Failed to get AI response. Please try again.");
		}
	}

	clearHistory(): void {
		this.messages = [];
	}

	getMessages(): ReadonlyArray<ChatMessage> {
		return this.messages;
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
