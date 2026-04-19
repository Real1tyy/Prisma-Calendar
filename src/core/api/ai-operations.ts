import type CustomCalendarPlugin from "../../main";
import { AI_DEFAULTS, type AIMode, type AIOperation } from "../../types/ai";
import { AIChatManager, ChatStore } from "../ai";
import type { ManipulationContext, PlanningContext } from "../ai/ai-context-builder";
import {
	executeOperations,
	gatherCalendarContext,
	gatherCategoryContext,
	gatherManipulationContext,
	gatherPlanningContext,
	parseOperations,
	resolveActiveViewContext,
} from "../ai/ai-engine";
import { type SemanticValidationContext, validateOperationsSemantically } from "../ai/ai-validation";
import { resolveBundle } from "./bundle-resolver";
import type { PrismaAIQueryInput, PrismaAIQueryResult } from "./types";

export async function aiQuery(plugin: CustomCalendarPlugin, input: PrismaAIQueryInput): Promise<PrismaAIQueryResult> {
	const mode: AIMode = input.mode ?? "query";
	const bundle = resolveBundle(plugin, input.calendarId);
	if (!bundle) {
		return { success: false, error: "No calendars available" };
	}

	const viewContext = resolveActiveViewContext(plugin, bundle);
	if (!viewContext) {
		return { success: false, error: "No calendar view is currently open" };
	}

	const chatStore = new ChatStore(plugin.app, plugin);
	const chatManager = new AIChatManager(plugin.settingsStore, chatStore);
	await chatManager.initialize();
	await chatManager.startNewThread(mode);

	const categoryContext = gatherCategoryContext(bundle);
	const aiSettings = plugin.settingsStore.currentSettings.ai;

	const customPrompts = input.customPromptIds
		? aiSettings.customPrompts.filter((p) => input.customPromptIds!.includes(p.id))
		: undefined;

	if (mode === "query") {
		const calendarContext = await gatherCalendarContext(bundle, viewContext);
		const response = await chatManager.sendMessage(
			input.message,
			customPrompts,
			calendarContext,
			undefined,
			undefined,
			categoryContext ?? undefined
		);

		return { success: true, response, mode };
	}

	let manipulationContext: ManipulationContext | undefined;
	let planningContext: PlanningContext | undefined;

	if (mode === "planning") {
		planningContext = await gatherPlanningContext(bundle, viewContext);
	} else {
		manipulationContext = await gatherManipulationContext(bundle, viewContext);
	}

	const validationContext: SemanticValidationContext = {
		mode,
		currentEvents: planningContext?.currentEvents ?? manipulationContext?.events,
		intervalStart: planningContext?.currentStart,
		intervalEnd: planningContext?.currentEnd,
		gapDetection: aiSettings.aiPlanningGapDetection,
		dayCoverage: aiSettings.aiPlanningDayCoverage,
	};

	const planningPromptFlags = planningContext
		? { gapDetection: aiSettings.aiPlanningGapDetection, dayCoverage: aiSettings.aiPlanningDayCoverage }
		: undefined;

	let currentMessage = input.message;
	let lastResponse = "";
	let lastOperations: AIOperation[] | null = null;
	let validationErrors: string[] = [];

	for (let attempt = 0; attempt <= AI_DEFAULTS.MAX_REPROMPT_RETRIES; attempt++) {
		const response = await chatManager.sendMessage(
			currentMessage,
			attempt === 0 ? customPrompts : undefined,
			undefined,
			manipulationContext,
			planningContext,
			categoryContext ?? undefined,
			planningPromptFlags
		);

		lastResponse = response;
		const operations = parseOperations(response);

		if (!operations) {
			return {
				success: false,
				error: "AI response could not be parsed as valid operations",
				response,
				mode,
			};
		}

		lastOperations = operations;
		validationErrors = validateOperationsSemantically(operations, validationContext);

		if (validationErrors.length === 0) {
			break;
		}

		if (attempt < AI_DEFAULTS.MAX_REPROMPT_RETRIES) {
			currentMessage =
				"Your response had validation errors:\n" +
				validationErrors.join("\n") +
				"\n\nFix these issues and respond with a corrected JSON array of operations.";
		}
	}

	if (!lastOperations) {
		return { success: false, error: "No operations produced", response: lastResponse, mode };
	}

	const result: PrismaAIQueryResult = {
		success: true,
		response: lastResponse,
		mode,
		operations: lastOperations,
	};

	if (validationErrors.length > 0) {
		result.validationErrors = validationErrors;
	}

	if (input.execute) {
		const executionResult = await executeOperations(plugin, lastOperations);
		result.executionResult = executionResult;
	}

	return result;
}
