export type PluginSlug =
	| "prisma-calendar"
	| "periodix-planner"
	| "fusion-goals"
	| "notes-manipulator"
	| "bases-improvements"
	| "nexus-properties"
	| "people-manager"
	| "page-header-manager"
	| "core-finance"
	| "reality-custom";

export type UiContext = "settings" | "whats-new" | "pro-gate" | "notice" | "ribbon" | "command";

export function buildUtmUrl(url: string, source: PluginSlug, medium: UiContext, content: string): string {
	const u = new URL(url);
	u.searchParams.set("utm_source", source);
	u.searchParams.set("utm_medium", medium);
	u.searchParams.set("utm_content", content);
	return u.toString();
}

interface PluginLinksConfig {
	docsBaseUrl: string;
	productPageUrl?: string;
	youtubeUrl?: string;
	githubUrl?: string;
}

interface PluginLink {
	text: string;
	href: string;
}

export function buildSettingsFooterLinks(slug: PluginSlug, config: PluginLinksConfig): PluginLink[] {
	const links: PluginLink[] = [];

	if (config.productPageUrl) {
		links.push({ text: "Product Page", href: buildUtmUrl(config.productPageUrl, slug, "settings", "product-page") });
	}
	links.push({ text: "Documentation", href: buildUtmUrl(config.docsBaseUrl, slug, "settings", "documentation") });
	links.push({
		text: "Changelog",
		href: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "settings", "changelog"),
	});
	links.push({
		text: "Support",
		href: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "settings", "support"),
	});
	if (config.youtubeUrl) {
		links.push({ text: "Video Tutorials", href: buildUtmUrl(config.youtubeUrl, slug, "settings", "youtube") });
	}

	return links;
}

export function buildWhatsNewLinks(
	slug: PluginSlug,
	config: { docsBaseUrl: string; githubUrl?: string }
): {
	support: string;
	changelog: string;
	documentation: string;
	github?: string;
	youtube: string;
} {
	return {
		support: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "whats-new", "support"),
		changelog: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "whats-new", "changelog"),
		documentation: buildUtmUrl(config.docsBaseUrl, slug, "whats-new", "documentation"),
		...(config.githubUrl ? { github: buildUtmUrl(config.githubUrl, slug, "whats-new", "github") } : {}),
		youtube: buildUtmUrl(
			"https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
			slug,
			"whats-new",
			"youtube"
		),
	};
}
