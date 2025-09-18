// @ts-check
// Docusaurus config for Prisma Calendar docs

const {themes: prismThemes} = require("prism-react-renderer");

/** @type {import('@docusaurus/types').Config} */
const config = {
	title: "Prisma Calendar",
	tagline: "A feature-rich, fully configurable calendar for Obsidian.",
	url: "https://Real1tyy.github.io",
	baseUrl: "/Prisma-Calendar/",
	favicon: "img/favicon.ico",
	organizationName: "Real1tyy",
	projectName: "Prisma-Calendar",
	onBrokenLinks: "throw",
	onBrokenMarkdownLinks: "warn",
	trailingSlash: false,
	i18n: { defaultLocale: "en", locales: ["en"] },
	themes: ["@docusaurus/theme-live-codeblock"],
	presets: [
		[
			"classic",
			{
				docs: {
					path: "docs",
					routeBasePath: "/",
					sidebarPath: require.resolve("./sidebars.js"),
					editUrl: "https://github.com/Real1tyy/Prisma-Calendar/edit/main/docs-site/",
					showLastUpdateAuthor: true,
					showLastUpdateTime: true
				},
				blog: false,
				theme: { customCss: require.resolve("./src/css/custom.css") }
			}
		]
	],
	themeConfig: {
		image: "img/social-card.png",
		colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
		navbar: {
			title: "Prisma Calendar",
			logo: { alt: "Prisma Calendar Logo", src: "img/logo.svg" },
			items: [
				{ to: "/", label: "Docs", position: "left" },
				{ to: "/features/overview", label: "Features", position: "left" },
				{ href: "https://www.youtube.com/watch?v=YOUR_VIDEO_ID", label: "Demo", position: "right" },
				{ href: "https://github.com/Real1tyy/Prisma-Calendar", label: "GitHub", position: "right" }
			]
		},
		footer: {
			style: "dark",
			links: [
				{
					title: "Docs",
					items: [
						{ label: "Introduction", to: "/" },
						{ label: "Installation", to: "/installation" },
						{ label: "Quick Start", to: "/quickstart" }
					]
				},
				{
					title: "Community",
					items: [
						{ label: "Obsidian Forum Thread", href: "https://forum.obsidian.md/" },
						{ label: "Issues", href: "https://github.com/Real1tyy/Prisma-Calendar/issues" }
					]
				},
				{
					title: "More",
					items: [
						{ label: "Demo Video", href: "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" },
						{ label: "Donate", href: "https://buymeacoffee.com/<your-handle>" }
					]
				}
			],
			copyright: `© ${new Date().getFullYear()} Prisma Calendar`
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
			additionalLanguages: ["bash", "json", "typescript"]
		},
		algolia: {
			appId: "YOUR_APP_ID",
			apiKey: "YOUR_PUBLIC_API_KEY",
			indexName: "prisma_calendar"
		}
	}
};

module.exports = config;
