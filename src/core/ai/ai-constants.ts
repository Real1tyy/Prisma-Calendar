export type AIProvider = "openai" | "anthropic";

export interface AIModelOption {
	label: string;
	provider: AIProvider;
}

export const AI_DEFAULTS = {
	OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
	ANTHROPIC_API_URL: "https://api.anthropic.com/v1/messages",
	ANTHROPIC_VERSION: "2023-06-01",
	DEFAULT_MODEL: "claude-sonnet-4-6",
	MODEL_OPTIONS: {
		"claude-opus-4-6": { label: "Claude Opus 4.6 (best quality)", provider: "anthropic" },
		"claude-sonnet-4-6": { label: "Claude Sonnet 4.6 (recommended)", provider: "anthropic" },
		"claude-haiku-4-5": { label: "Claude Haiku 4.5 (fast, cheap)", provider: "anthropic" },
		"gpt-5.2": { label: "GPT-5.2 (best quality, OpenAI)", provider: "openai" },
		"gpt-5.1": { label: "GPT-5.1", provider: "openai" },
		"gpt-5-mini": { label: "GPT-5 Mini (fast, cheap)", provider: "openai" },
		"gpt-5-nano": { label: "GPT-5 Nano (ultra cheap)", provider: "openai" },
	} as Record<string, AIModelOption>,
} as const;
