// esbuild inlines these as data:image/<format>;base64,... strings at build time.
// Images live in docs-site/static/img/pro-previews/ so they're shared with the docs site.
// Replace each placeholder .png with a real screenshot and rebuild.
import aiChatPreview from "../../docs-site/static/img/pro-previews/ai-chat.png";
import basesViewPreview from "../../docs-site/static/img/pro-previews/bases-view.png";
import dashboardPreview from "../../docs-site/static/img/pro-previews/dashboard.png";
import ganttPreview from "../../docs-site/static/img/pro-previews/gantt.png";
import heatmapPreview from "../../docs-site/static/img/pro-previews/heatmap.png";
import { type PRO_FEATURES, PRO_PURCHASE_URL } from "./license";

export type ProFeatureKey = keyof typeof PRO_FEATURES;

interface ProFeatureConfig {
	docPath: string;
	preview?: string;
}

const DOCS_BASE_URL = "https://real1tyy.github.io/Prisma-Calendar";
const UTM_SOURCE = "obsidian-plugin";
const UTM_MEDIUM = "pro-gate";

const PRO_FEATURE_CONFIG: Record<ProFeatureKey, ProFeatureConfig> = {
	AI_CHAT: { docPath: "features/advanced/ai-chat", preview: aiChatPreview },
	CALDAV_SYNC: { docPath: "features/advanced/integrations" },
	ICS_SYNC: { docPath: "features/advanced/integrations" },
	PROGRAMMATIC_API: { docPath: "features/advanced/programmatic-api/overview" },
	CATEGORY_ASSIGNMENT_PRESETS: { docPath: "features/organization/categories" },
	UNLIMITED_CALENDARS: { docPath: "features/calendar/multiple-calendars" },
	UNLIMITED_EVENT_PRESETS: { docPath: "features/events/event-presets" },
	HEATMAP: { docPath: "features/views/heatmap", preview: heatmapPreview },
	BASES_VIEW: { docPath: "features/views/bases-calendar-view", preview: basesViewPreview },
	PREREQUISITE_CONNECTIONS: { docPath: "features/advanced/prerequisite-connections" },
	GANTT: { docPath: "features/views/gantt", preview: ganttPreview },
	DASHBOARD: { docPath: "features/views/dashboard", preview: dashboardPreview },
};

export function getFeaturePreviewSrc(featureKey: ProFeatureKey): string | null {
	return PRO_FEATURE_CONFIG[featureKey].preview ?? null;
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

export function getProGateUrls(featureKey: ProFeatureKey): { docsUrl: string; purchaseUrl: string } {
	return { docsUrl: getFeatureDocUrl(featureKey), purchaseUrl: getFeaturePurchaseUrl(featureKey) };
}
