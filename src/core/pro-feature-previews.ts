// esbuild inlines these as data:image/<format>;base64,... strings at build time.
// Replace each placeholder .png with a real screenshot and rebuild.
import aiChatPreview from "../assets/pro-previews/ai-chat.png";
import basesViewPreview from "../assets/pro-previews/bases-view.png";
import caldavSyncPreview from "../assets/pro-previews/caldav-sync.png";
import categoryPresetsPreview from "../assets/pro-previews/category-presets.png";
import connectionsPreview from "../assets/pro-previews/connections.png";
import dashboardPreview from "../assets/pro-previews/dashboard.png";
import ganttPreview from "../assets/pro-previews/gantt.png";
import heatmapPreview from "../assets/pro-previews/heatmap.png";
import icsSyncPreview from "../assets/pro-previews/ics-sync.png";
import programmaticApiPreview from "../assets/pro-previews/programmatic-api.png";
import unlimitedCalendarsPreview from "../assets/pro-previews/unlimited-calendars.png";
import unlimitedPresetsPreview from "../assets/pro-previews/unlimited-presets.png";
import { type PRO_FEATURES, PRO_PURCHASE_URL } from "./license";

export type ProFeatureKey = keyof typeof PRO_FEATURES;

interface ProFeatureConfig {
	docPath: string;
	preview: string;
}

const DOCS_BASE_URL = "https://real1tyy.github.io/Prisma-Calendar";
const UTM_SOURCE = "obsidian-plugin";
const UTM_MEDIUM = "pro-gate";

const PRO_FEATURE_CONFIG: Record<ProFeatureKey, ProFeatureConfig> = {
	AI_CHAT: { docPath: "docs/features/advanced/ai-chat", preview: aiChatPreview },
	CALDAV_SYNC: { docPath: "docs/features/advanced/integrations", preview: caldavSyncPreview },
	ICS_SYNC: { docPath: "docs/features/advanced/integrations", preview: icsSyncPreview },
	PROGRAMMATIC_API: { docPath: "docs/features/advanced/programmatic-api/overview", preview: programmaticApiPreview },
	CATEGORY_ASSIGNMENT_PRESETS: { docPath: "docs/features/organization/categories", preview: categoryPresetsPreview },
	UNLIMITED_CALENDARS: { docPath: "docs/features/calendar/multiple-calendars", preview: unlimitedCalendarsPreview },
	UNLIMITED_EVENT_PRESETS: { docPath: "docs/features/events/event-presets", preview: unlimitedPresetsPreview },
	HEATMAP: { docPath: "docs/features/views/heatmap", preview: heatmapPreview },
	BASES_VIEW: { docPath: "docs/features/views/bases-calendar-view", preview: basesViewPreview },
	PREREQUISITE_CONNECTIONS: {
		docPath: "docs/features/advanced/prerequisite-connections",
		preview: connectionsPreview,
	},
	GANTT: { docPath: "docs/features/views/gantt", preview: ganttPreview },
	DASHBOARD: { docPath: "docs/features/views/dashboard", preview: dashboardPreview },
};

export function getFeaturePreviewSrc(featureKey: ProFeatureKey): string {
	return PRO_FEATURE_CONFIG[featureKey].preview;
}

function buildUtmParams(featureKey: ProFeatureKey): string {
	const content = featureKey.toLowerCase().replace(/_/g, "-");
	return `utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}&utm_content=${content}`;
}

export function getFeatureDocUrl(featureKey: ProFeatureKey): string {
	return `${DOCS_BASE_URL}/${PRO_FEATURE_CONFIG[featureKey].docPath}?${buildUtmParams(featureKey)}`;
}

export function getFeaturePurchaseUrl(featureKey: ProFeatureKey): string {
	return `${PRO_PURCHASE_URL}?${buildUtmParams(featureKey)}`;
}
