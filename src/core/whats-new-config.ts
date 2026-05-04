import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import type { WhatsNewModalConfig } from "@real1ty-obsidian-plugins-react";

const GITHUB_URL = "https://github.com/Real1tyy/Prisma-Calendar";
const PRODUCT_PAGE_URL = "https://matejvavroproductivity.com/tools/prisma-calendar/";
const SUPPORT_URL = "https://real1tyy.github.io/Prisma-Calendar/support";
const CHANGELOG_URL = "https://real1tyy.github.io/Prisma-Calendar/changelog";
const DOCS_URL = "https://real1tyy.github.io/Prisma-Calendar/";

export function buildWhatsNewConfig(changelogContent: string, utmSection: string): WhatsNewModalConfig {
	const buildUrl = (baseUrl: string, campaignContent: string) =>
		buildUtmUrl(baseUrl, "prisma-calendar", "plugin", utmSection, campaignContent);
	return {
		cssPrefix: "prisma",
		pluginName: "Prisma Calendar",
		changelogContent,
		links: {
			github: GITHUB_URL,
			productPage: buildUrl(PRODUCT_PAGE_URL, "product_page"),
			support: buildUrl(SUPPORT_URL, "support"),
			changelog: buildUrl(CHANGELOG_URL, "changelog"),
			documentation: buildUrl(DOCS_URL, "documentation"),
		},
		supportSection: {
			heading: "Unlock the full experience with Pro",
			description:
				"For more connected, advanced workflows, Prisma Pro unlocks external calendar synchronization, advanced visualizations, database integration, and other power-user capabilities built for serious planning inside Obsidian.",
			cta: {
				text: "Start your 30-day free trial — cancel anytime",
				href: buildUrl(PRODUCT_PAGE_URL, "pro"),
			},
		},
	};
}
