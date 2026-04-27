import { formatChangelogSections, getChangelogSince } from "@real1ty-obsidian-plugins";
import type { App, Plugin } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import { memo, useCallback, useEffect, useRef } from "react";

import { useApp } from "../contexts/app-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactModal } from "../show-react-modal";

function buildWhatsNewStyles(p: string): string {
	return `
.modal-container.mod-dim .modal:has(.${p}-whats-new-modal) { max-width: 750px; width: 90%; }
.${p}-whats-new-subtitle { color: var(--text-muted); font-size: 0.9rem; margin: 0 0 1rem; }
.${p}-whats-new-support {
	margin: 0 0 1rem; padding: 1rem; background-color: var(--background-secondary); border-radius: 8px;
}
.${p}-whats-new-support h3 { margin-top: 0; margin-bottom: 0.5rem; font-size: 1rem; }
.${p}-whats-new-support p { margin: 0.5rem 0; color: var(--text-normal); }
.${p}-whats-new-support a { color: var(--link-color); text-decoration: none; transition: all 0.2s ease; }
.${p}-whats-new-support a:hover { color: var(--link-color-hover); text-decoration: underline; }
.${p}-whats-new-content {
	max-height: 400px; overflow-y: auto; margin-bottom: 1rem; padding-right: 0.5rem; border-radius: 8px;
}
.${p}-whats-new-content h2 { font-size: 1.3rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-accent); }
.${p}-whats-new-content h3 { font-size: 1.1rem; margin-top: 1rem; margin-bottom: 0.5rem; }
.${p}-whats-new-content ul { padding-left: 1.5rem; }
.${p}-whats-new-content li { margin-bottom: 0.5rem; line-height: 1.6; }
.${p}-whats-new-content code {
	background: var(--code-background); padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em;
}
.${p}-whats-new-content a.external-link { color: var(--link-external-color); }
.${p}-whats-new-content a.external-link::after { content: "\\2197"; margin-left: 0.2em; font-size: 0.8em; }
.${p}-whats-new-empty { text-align: center; color: var(--text-muted); padding: 2rem; font-style: italic; }
.${p}-whats-new-sticky-footer {
	position: sticky; bottom: 0; background: var(--background-primary); padding-top: 0.75rem;
	z-index: 10; border-top: 1px solid var(--background-modifier-border);
}
.${p}-whats-new-buttons {
	display: flex; gap: 0.5rem; justify-content: space-between; flex-wrap: wrap;
	padding-bottom: 0.5rem; width: 100%;
}
.${p}-whats-new-buttons button {
	flex: 1; min-width: 0; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;
	border: 1px solid var(--background-modifier-border); background: var(--interactive-normal);
	color: var(--text-normal); transition: all 0.2s ease; text-align: center;
}
.${p}-whats-new-buttons button:hover {
	background: var(--interactive-hover); border-color: var(--interactive-accent);
	transform: translateY(-1px); box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.${p}-whats-new-buttons button:active { transform: translateY(0); box-shadow: 0 1px 4px rgb(0 0 0 / 10%); }
`;
}

export const DEFAULT_WHATS_NEW_LINKS = {
	TOOLS: "https://matejvavroproductivity.com/tools/",
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

export interface WhatsNewModalConfig {
	cssPrefix: string;
	pluginName: string;
	changelogContent: string;
	links: {
		support: string;
		changelog: string;
		documentation: string;
		github: string;
		productPage?: string;
		tools?: string;
		youtube?: string;
	};
	supportSection?: {
		heading: string;
		description: string;
		cta?: { text: string; href: string };
	};
}

interface WhatsNewContentProps {
	config: WhatsNewModalConfig;
	plugin: Plugin;
	fromVersion: string;
	toVersion: string;
	close: () => void;
}

function makeExternalLinksClickable(container: HTMLElement, documentationBaseUrl: string): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");
	for (const link of Array.from(links)) {
		const href = link.getAttribute("href");
		if (!href) continue;

		let finalUrl: string | null = null;
		if (href.startsWith("http://") || href.startsWith("https://")) {
			finalUrl = href;
		} else if (href.startsWith("/")) {
			const normalizedBase = documentationBaseUrl.endsWith("/")
				? documentationBaseUrl.slice(0, -1)
				: documentationBaseUrl;
			finalUrl = `${normalizedBase}${href}`;
		}

		if (finalUrl) {
			const url = finalUrl;
			link.addEventListener("click", (e: MouseEvent) => {
				e.preventDefault();
				window.open(url, "_blank");
			});
			link.classList.add("external-link");
		}
	}
}

function FooterButton({ label, href }: { label: string; href: string }) {
	const handleClick = useCallback(() => window.open(href, "_blank"), [href]);
	return (
		<button type="button" onClick={handleClick}>
			{label}
		</button>
	);
}

export const WhatsNewContent = memo(function WhatsNewContent({
	config,
	plugin,
	fromVersion,
	toVersion,
	close: _close,
}: WhatsNewContentProps) {
	const app = useApp();
	const changelogRef = useRef<HTMLDivElement>(null);
	useInjectedStyles(`${config.cssPrefix}-whats-new-styles`, buildWhatsNewStyles(config.cssPrefix));
	const cls = (suffix: string) => `${config.cssPrefix}-${suffix}`;

	const changelogSections = getChangelogSince(config.changelogContent, fromVersion, toVersion);
	const markdownContent = changelogSections.length > 0 ? formatChangelogSections(changelogSections) : "";

	useEffect(() => {
		if (!changelogRef.current || !markdownContent) return;
		const el = changelogRef.current;
		while (el.firstChild) el.removeChild(el.firstChild);

		// eslint-disable-next-line obsidianmd/no-plugin-as-component -- short-lived modal, cleaned up on close
		void MarkdownRenderer.render(app, markdownContent, el, "/", plugin).then(() => {
			makeExternalLinksClickable(el, config.links.documentation);
		});
	}, [app, markdownContent, plugin, config.links.documentation]);

	const toolsUrl = config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS;
	const youtubeUrl = config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE;

	return (
		<div data-testid={`${config.cssPrefix}-whats-new-modal`}>
			<p className={cls("whats-new-subtitle")}>Changes since v{fromVersion}</p>

			<div className={cls("whats-new-support")}>
				{config.supportSection ? (
					<>
						<h3>{config.supportSection.heading}</h3>
						<p>{config.supportSection.description}</p>
						{config.supportSection.cta && (
							<p>
								{"👉 "}
								<a href={config.supportSection.cta.href}>{config.supportSection.cta.text}</a>
							</p>
						)}
					</>
				) : (
					<>
						<h3>Support the development of this plugin</h3>
						<p>
							If this plugin saves you time or improves how you work in Obsidian, consider supporting its development.
							Your support helps fund ongoing maintenance, new features, and long-term stability.
						</p>
						<p>
							{"👉 "}
							<a href={config.links.support}>Support my work</a>
						</p>
					</>
				)}
				<p>
					You can also explore my <a href={toolsUrl}>other Obsidian plugins and productivity tools</a>, or follow my{" "}
					<a href={youtubeUrl}>YouTube channel</a> for in-depth tutorials and workflow ideas.
				</p>
			</div>

			{changelogSections.length === 0 ? (
				<p className={cls("whats-new-empty")}>No significant changes found in this update.</p>
			) : (
				<div ref={changelogRef} className={cls("whats-new-content")} />
			)}

			<div className={cls("whats-new-sticky-footer")}>
				<div className={cls("whats-new-buttons")}>
					{config.links.productPage && <FooterButton label="Product Page" href={config.links.productPage} />}
					<FooterButton label="GitHub" href={config.links.github} />
					<FooterButton label="Changelog" href={config.links.changelog} />
					<FooterButton label="Documentation" href={config.links.documentation} />
					<FooterButton label="Other Plugins" href={toolsUrl} />
					<FooterButton label="YouTube" href={youtubeUrl} />
				</div>
			</div>
		</div>
	);
});

export function showWhatsNewReactModal(
	app: App,
	plugin: Plugin,
	config: WhatsNewModalConfig,
	fromVersion: string,
	toVersion: string
): void {
	showReactModal({
		app,
		cls: `${config.cssPrefix}-whats-new-modal`,
		title: `${config.pluginName} updated to v${toVersion}`,
		render: (close) => (
			<WhatsNewContent config={config} plugin={plugin} fromVersion={fromVersion} toVersion={toVersion} close={close} />
		),
	});
}
