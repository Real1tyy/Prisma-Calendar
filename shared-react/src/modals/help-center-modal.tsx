import { buildUtmUrl, resolveRelativeDocLinks, type PluginSlug } from "@real1ty/obsidian-plugins";
import { Component, MarkdownRenderer, type App } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "../contexts/app-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { showReactModal } from "../show-react-modal";
import { makeExternalLinksClickable } from "../utils/external-links";
import { openExternal } from "../utils/open-external";
import { buildHelpCenterStyles } from "./help-center-modal.styles";

const HELP_UTM_SOURCE = "plugin";
const HELP_UTM_MEDIUM = "help_center";

/**
 * The per-plugin content a Help Center bundles. `faq` and `troubleshooting` are
 * the plugin's own documentation pages, bundled at build time and rendered as
 * Markdown — never hand-duplicated prose that drifts out of date. Every field is
 * optional: with none supplied the modal still surfaces the Get-help links.
 */
export interface HelpCenterContent {
	/** "What is X?" intro Markdown for the Overview tab. */
	about?: string;
	/** FAQ page Markdown (e.g. the bundled `faq.md`). The tab appears when set. */
	faq?: string;
	/** Troubleshooting page Markdown (e.g. the bundled `troubleshooting.md`). */
	troubleshooting?: string;
}

export interface HelpCenterConfig extends HelpCenterContent {
	/** Trailing-dash CSS prefix, e.g. `"prisma-"` — drives the modal class + styles. */
	cssPrefix: string;
	/** Display name woven into the title, e.g. `"Prisma Calendar"`. */
	pluginName: string;
	/** Slug → `utm_campaign` for every outbound Get-help link. */
	slug: PluginSlug;
	/** Outbound destinations (no UTM — the modal appends it). */
	links: {
		/** Docs home — also the base used to absolutise relative links in the bundled Markdown. */
		documentation: string;
		githubIssues: string;
		feedback?: string;
	};
}

type TabId = "overview" | "faq" | "troubleshooting" | "help";

interface TabDef {
	id: TabId;
	label: string;
}

/**
 * Renders authored Markdown through Obsidian's `MarkdownRenderer` under a scoped
 * `Component` so embeds/link-events tear down when the tab switches or the modal
 * closes. External links are rewired to open in the system browser.
 */
const MarkdownBlock = memo(function MarkdownBlock({ markdown, className }: { markdown: string; className?: string }) {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const component = new Component();
		component.load();
		el.replaceChildren();
		void MarkdownRenderer.render(app, markdown, el, "/", component).then(() => makeExternalLinksClickable(el));
		return () => component.unload();
	}, [app, markdown]);

	return <div ref={ref} className={className} />;
});

export const HelpCenterView = memo(function HelpCenterView({ config }: { config: HelpCenterConfig }) {
	const { cls, tid } = useScopedStyles("help-center", buildHelpCenterStyles);
	const { about, faq, troubleshooting, links, slug } = config;

	// Absolutise the relative links the bundled docs use (e.g. `./features/x.md`)
	// against the live docs site so they resolve when clicked from inside Obsidian.
	const docBase = links.documentation;
	const aboutMd = useMemo(
		() => (about !== undefined ? resolveRelativeDocLinks(about, docBase) : undefined),
		[about, docBase]
	);
	const faqMd = useMemo(() => (faq !== undefined ? resolveRelativeDocLinks(faq, docBase) : undefined), [faq, docBase]);
	const troubleshootingMd = useMemo(
		() => (troubleshooting !== undefined ? resolveRelativeDocLinks(troubleshooting, docBase) : undefined),
		[troubleshooting, docBase]
	);

	const tabs = useMemo<TabDef[]>(() => {
		const defs: TabDef[] = [];
		if (aboutMd !== undefined) defs.push({ id: "overview", label: "Overview" });
		if (faqMd !== undefined) defs.push({ id: "faq", label: "FAQ" });
		if (troubleshootingMd !== undefined) defs.push({ id: "troubleshooting", label: "Troubleshooting" });
		defs.push({ id: "help", label: "Get help" });
		return defs;
	}, [aboutMd, faqMd, troubleshootingMd]);

	const [active, setActive] = useState<TabId>(() => tabs[0]?.id ?? "help");

	const utm = useCallback(
		(url: string, content: string): string => buildUtmUrl(url, slug, HELP_UTM_SOURCE, HELP_UTM_MEDIUM, content),
		[slug]
	);

	return (
		<div data-testid={tid("modal")}>
			<div className={cls("tabs")}>
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						className={`${cls("tab")}${active === tab.id ? ` ${cls("tab-active")}` : ""}`}
						onClick={() => setActive(tab.id)}
						data-testid={tid(`tab-${tab.id}`)}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className={cls("panel")} data-testid={tid(`panel-${active}`)}>
				{active === "overview" && aboutMd !== undefined && <MarkdownBlock markdown={aboutMd} className={cls("doc")} />}

				{active === "faq" && faqMd !== undefined && <MarkdownBlock markdown={faqMd} className={cls("doc")} />}

				{active === "troubleshooting" && troubleshootingMd !== undefined && (
					<MarkdownBlock markdown={troubleshootingMd} className={cls("doc")} />
				)}

				{active === "help" && (
					<div className={cls("get-help")}>
						<p>
							Still stuck? The documentation covers most topics. If you've spotted a bug or have an idea, opening a
							GitHub issue is the fastest way to reach me.
						</p>
						<div className={cls("actions")}>
							<button
								type="button"
								onClick={() => openExternal(utm(links.documentation, "help_documentation"))}
								data-testid={tid("action-documentation")}
							>
								Documentation
							</button>
							<button
								type="button"
								className={cls("action-primary")}
								onClick={() => openExternal(utm(links.githubIssues, "help_github"))}
								data-testid={tid("action-github")}
							>
								Open a GitHub issue
							</button>
							{links.feedback !== undefined && (
								<button
									type="button"
									onClick={() => openExternal(utm(links.feedback as string, "help_feedback"))}
									data-testid={tid("action-feedback")}
								>
									Send feedback
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
});

/** Opens the shared Help Center modal for a plugin. */
export function showHelpCenterReactModal(app: App, config: HelpCenterConfig): void {
	showReactModal({
		app,
		cls: `${config.cssPrefix}help-center-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: `${config.pluginName} help`,
		render: () => <HelpCenterView config={config} />,
	});
}
