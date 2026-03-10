import type { RequestUrlResponse } from "obsidian";
import { requestUrl } from "obsidian";

import { AI_DEFAULTS, type AIProvider } from "./ai-constants";

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface StoredChatMessage extends ChatMessage {
	id: string;
	createdAt: string;
}

export interface ThreadMeta {
	id: string;
	title: string;
	mode: string;
	createdAt: string;
	updatedAt: string;
}

export interface ThreadData {
	id: string;
	title: string;
	mode: string;
	createdAt: string;
	updatedAt: string;
	messages: StoredChatMessage[];
}

export class AIServiceError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number
	) {
		super(message);
		this.name = "AIServiceError";
	}
}

export async function callOpenAI(
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ChatMessage[]
): Promise<string> {
	const response = await requestUrl({
		url: AI_DEFAULTS.OPENAI_API_URL,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "system", content: systemPrompt }, ...messages],
		}),
		throw: false,
	});

	handleHTTPError(response, "OpenAI");

	const data = response.json as {
		choices?: Array<{ message?: { content?: string } }>;
	};

	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new AIServiceError("Empty response from OpenAI. Please try again.");
	}
	return content;
}

export async function callAnthropic(
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ChatMessage[]
): Promise<string> {
	const response = await requestUrl({
		url: AI_DEFAULTS.ANTHROPIC_API_URL,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": AI_DEFAULTS.ANTHROPIC_VERSION,
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			system: systemPrompt,
			messages,
		}),
		throw: false,
	});

	handleHTTPError(response, "Anthropic");

	const data = response.json as {
		content?: Array<{ type: string; text?: string }>;
	};

	const textBlock = data.content?.find((b) => b.type === "text");
	if (!textBlock?.text) {
		throw new AIServiceError("Empty response from Anthropic. Please try again.");
	}
	return textBlock.text;
}

export function callAI(
	provider: AIProvider,
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ChatMessage[]
): Promise<string> {
	return provider === "anthropic"
		? callAnthropic(apiKey, model, systemPrompt, messages)
		: callOpenAI(apiKey, model, systemPrompt, messages);
}

function handleHTTPError(response: RequestUrlResponse, provider: string): void {
	if (response.status === 401) {
		throw new AIServiceError(`Invalid API key. Check your ${provider} API key in settings.`, 401);
	}
	if (response.status === 429) {
		throw new AIServiceError("Rate limit exceeded. Please wait a moment and try again.", 429);
	}
	if (response.status < 200 || response.status >= 300) {
		let detail = "";
		try {
			const body = response.json as { error?: { message?: string } };
			if (body?.error?.message) {
				detail = `: ${body.error.message}`;
			}
		} catch {
			/* response may not be JSON */
		}
		throw new AIServiceError(`${provider} API error ${response.status}${detail}`, response.status);
	}
}
