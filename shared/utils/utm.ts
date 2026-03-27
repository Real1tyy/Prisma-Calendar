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
	u.searchParams.set("utm_campaign", slug.replaceAll("-", "_"));
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
			href: buildUtmUrl(config.productPageUrl, slug, "plugin", "in_app", "settings_product_page"),
		});
	}
	links.push({
		text: "Documentation",
		href: buildUtmUrl(config.docsBaseUrl, slug, "plugin", "in_app", "settings_documentation"),
	});
	links.push({
		text: "Changelog",
		href: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "plugin", "in_app", "settings_changelog"),
	});
	links.push({
		text: "Support",
		href: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "plugin", "in_app", "settings_support"),
	});
	if (config.youtubeUrl) {
		links.push({
			text: "Video Tutorials",
			href: buildUtmUrl(config.youtubeUrl, slug, "plugin", "in_app", "settings_youtube"),
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
		support: buildUtmUrl("https://matejvavroproductivity.com/support/", slug, "plugin", "in_app", "whats_new_support"),
		changelog: buildUtmUrl(`${config.docsBaseUrl}/changelog`, slug, "plugin", "in_app", "whats_new_changelog"),
		documentation: buildUtmUrl(config.docsBaseUrl, slug, "plugin", "in_app", "whats_new_documentation"),
		...(config.githubUrl
			? { github: buildUtmUrl(config.githubUrl, slug, "plugin", "in_app", "whats_new_github") }
			: {}),
		youtube: buildUtmUrl(
			"https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
			slug,
			"plugin",
			"in_app",
			"whats_new_youtube"
		),
	};
}
