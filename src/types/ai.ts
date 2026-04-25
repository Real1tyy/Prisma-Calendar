import { z } from "zod";

// ─── AI Modes & Providers ────────────────────────────────────────────

const _AIModeSchema = z.enum(["query", "manipulation", "planning"]);
export type AIMode = z.infer<typeof _AIModeSchema>;

const _AIProviderSchema = z.enum(["openai", "anthropic"]);
export type AIProvider = z.infer<typeof _AIProviderSchema>;

export interface AIModelOption {
	label: string;
	provider: AIProvider;
}

export const AI_DEFAULTS = {
	OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
	ANTHROPIC_API_URL: "https://api.anthropic.com/v1/messages",
	ANTHROPIC_VERSION: "2023-06-01",
	DEFAULT_MODEL: "claude-sonnet-4-6",
	DEFAULT_BATCH_EXECUTION: true,
	DEFAULT_CONFIRM_EXECUTION: true,
	DEFAULT_PLANNING_GAP_DETECTION: true,
	DEFAULT_PLANNING_DAY_COVERAGE: true,
	MAX_REPROMPT_RETRIES: 2,
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

// ─── AI Operation Schemas ────────────────────────────────────────────

const ISODatetimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

const EventFieldsSchema = z.object({
	title: z.string().min(1),
	start: ISODatetimeSchema,
	end: ISODatetimeSchema,
	allDay: z.boolean().optional(),
	categories: z.array(z.string()).optional(),
	location: z.string().optional(),
	participants: z.array(z.string()).optional(),
});

export const CreateOpSchema = EventFieldsSchema.extend({
	type: z.literal("create"),
});

export const EditOpSchema = EventFieldsSchema.partial().extend({
	type: z.literal("edit"),
	filePath: z.string().min(1),
});

export const DeleteOpSchema = z.object({
	type: z.literal("delete"),
	filePath: z.string().min(1),
});

export const AIOperationsSchema = z.array(z.discriminatedUnion("type", [CreateOpSchema, EditOpSchema, DeleteOpSchema]));

export type AIOperation = z.infer<typeof AIOperationsSchema>[number];
