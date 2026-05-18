// Preview screenshots are served from the docs site rather than inlined as
// base64 data URLs to keep main.js under Obsidian Sync Standard's 5 MB cap —
// inlining all PNGs added ~1 MB to the bundle. The source images still live in
// `docs-site/static/img/pro-previews/` and are deployed by Docusaurus to
// `<DOCS_BASE_URL>/img/pro-previews/<file>.png`.
import { buildUtmUrl } from "@real1ty-obsidian-plugins";

import { PRO_PURCHASE_URL, type PRO_FEATURES } from "./license";

export type ProFeatureKey = keyof typeof PRO_FEATURES;

interface ProFeatureConfig {
	docPath: string;
	previewFile?: string;
}

const DOCS_BASE_URL = "https://real1tyy.github.io/Prisma-Calendar";
const PREVIEW_BASE_URL = `${DOCS_BASE_URL}/img/pro-previews`;

const PRO_FEATURE_CONFIG: Record<ProFeatureKey, ProFeatureConfig> = {
	AI_CHAT: { docPath: "features/advanced/ai-chat", previewFile: "ai-chat.png" },
	CALDAV_SYNC: { docPath: "features/advanced/integrations" },
	ICS_SYNC: { docPath: "features/advanced/integrations" },
	PROGRAMMATIC_API: { docPath: "features/advanced/programmatic-api/overview" },
	CATEGORY_ASSIGNMENT_PRESETS: { docPath: "features/organization/categories" },
	UNLIMITED_CALENDARS: { docPath: "features/calendar/multiple-calendars" },
	UNLIMITED_EVENT_PRESETS: { docPath: "features/events/event-presets" },
	HEATMAP: { docPath: "features/views/heatmap", previewFile: "heatmap.png" },
	HEATMAP_MONTHLY: { docPath: "features/views/heatmap-monthly-stats", previewFile: "heatmap_monthly.png" },
	BASES_VIEW: { docPath: "features/views/bases-calendar-view", previewFile: "bases-view.png" },
	PREREQUISITE_CONNECTIONS: { docPath: "features/advanced/prerequisite-connections" },
	GANTT: { docPath: "features/views/gantt", previewFile: "gantt.png" },
	DASHBOARD: { docPath: "features/views/dashboard", previewFile: "dashboard.png" },
};

export function getFeaturePreviewSrc(featureKey: ProFeatureKey): string | null {
	const file = PRO_FEATURE_CONFIG[featureKey].previewFile;
	return file ? `${PREVIEW_BASE_URL}/${file}` : null;
}

function featureContent(featureKey: ProFeatureKey): string {
	return featureKey.toLowerCase().replace(/_/g, "-");
}

export function getFeatureDocUrl(featureKey: ProFeatureKey): string {
	return buildUtmUrl(
		`${DOCS_BASE_URL}/${PRO_FEATURE_CONFIG[featureKey].docPath}`,
		"prisma-calendar",
		"plugin",
		"pro_gate",
		featureContent(featureKey)
	);
}

export function getFeaturePurchaseUrl(featureKey: ProFeatureKey): string {
	return buildUtmUrl(PRO_PURCHASE_URL, "prisma-calendar", "plugin", "pro_gate", featureContent(featureKey));
}

export function getProGateUrls(featureKey: ProFeatureKey): { docsUrl: string; purchaseUrl: string } {
	return { docsUrl: getFeatureDocUrl(featureKey), purchaseUrl: getFeaturePurchaseUrl(featureKey) };
}
