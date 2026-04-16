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

export function buildUtmUrl(url: string, slug: PluginSlug, source: string, medium: string, content: string): string {
	const u = new URL(url);
	u.searchParams.set("utm_campaign", slug.replace(/-/g, "_"));
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
		links.push({
			text: "Product Page",
			href: buildUtmUrl(config.productPageUrl, slug, "plugin", "settings", "product_page"),
		});
	}
	links.push({
		text: "Documentation",
		href: buildUtmUrl(config.docsBaseUrl, slug, "plugin", "settings", "documentation"),
	});
	links.push({
		text: "Changelog",
		href: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "plugin", "settings", "changelog"),
	});
	links.push({
		text: "Support",
		href: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "plugin", "settings", "support"),
	});
	if (config.youtubeUrl) {
		links.push({
			text: "Video Tutorials",
			href: buildUtmUrl(config.youtubeUrl, slug, "plugin", "settings", "youtube"),
		});
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
		support: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "plugin", "whats_new", "support"),
		changelog: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "plugin", "whats_new", "changelog"),
		documentation: buildUtmUrl(config.docsBaseUrl, slug, "plugin", "whats_new", "documentation"),
		...(config.githubUrl ? { github: buildUtmUrl(config.githubUrl, slug, "plugin", "whats_new", "github") } : {}),
		youtube: buildUtmUrl(
			"https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
			slug,
			"plugin",
			"whats_new",
			"youtube"
		),
	};
}
