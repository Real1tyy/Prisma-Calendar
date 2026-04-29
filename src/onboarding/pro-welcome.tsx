import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { showReactModal, WelcomeModalShell } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo } from "react";

import { ACCOUNT_URL } from "../core/license";

const proUtm = (url: string, content: string) =>
	buildUtmUrl(url, "prisma-calendar", "plugin", "pro_welcome_modal", content);

const TAGLINE = (
	<>
		<span className="prisma-welcome-tagline-sub">
			You now have full access to all Pro features. Your 30-day free trial has started — take your time exploring
			everything.
		</span>
		<span className="prisma-welcome-tagline-sub">
			Start by connecting your calendar, exploring advanced views, or using AI to plan your events.
		</span>
	</>
);

const FOOTER_LINKS = [
	{
		label: "Pro Features",
		href: proUtm("https://real1tyy.github.io/Prisma-Calendar/features/free-vs-pro", "pro_features"),
	},
	{ label: "Documentation", href: proUtm("https://real1tyy.github.io/Prisma-Calendar/", "documentation") },
	{ label: "Manage Subscription", href: proUtm(ACCOUNT_URL, "account") },
	{
		label: "Support",
		href: proUtm("mailto:hello@matejvavroproductivity.com", "support_email"),
	},
	{
		label: "Share Feedback",
		href: proUtm("https://github.com/Real1tyy/Prisma-Calendar/issues", "feedback"),
	},
];

export interface ProWelcomeControllerProps {
	onSubmit: () => void;
}

export const ProWelcomeController = memo(function ProWelcomeController({ onSubmit }: ProWelcomeControllerProps) {
	return (
		<WelcomeModalShell
			cssPrefix="prisma"
			title="Welcome to Prisma Pro"
			tagline={TAGLINE}
			videoEmbedUrl="https://www.youtube.com/embed/PLACEHOLDER_PRO_VIDEO_ID"
			videoCaption="A quick tour of everything Pro unlocks for your planning workflow."
			footerLinks={FOOTER_LINKS}
			testIdPrefix="prisma-pro-welcome"
			onSubmit={onSubmit}
		>
			<p className="prisma-pro-welcome-trial">30-day free trial — cancel anytime before billing starts.</p>

			<section className="prisma-pro-welcome-highlights">
				<h3 className="prisma-pro-welcome-highlights-title">What's now unlocked</h3>
				<div className="prisma-pro-welcome-grid">
					<HighlightCard
						title="See your time differently"
						desc="Use Gantt, Heatmap, and Dashboard to understand patterns and dependencies."
					/>
					<HighlightCard
						title="Connect your real calendar"
						desc="Sync Google, Apple, or Outlook using CalDAV and ICS."
					/>
					<HighlightCard title="Plan faster with AI" desc="Create, edit, and organize events using natural language." />
					<HighlightCard
						title="Build your system"
						desc="Use unlimited calendars, presets, and API to shape your workflow."
					/>
				</div>
			</section>

			<section className="prisma-pro-welcome-next">
				<h3>Start here</h3>
				<ul>
					<li>Connect your external calendar (CalDAV / ICS)</li>
					<li>Try the Heatmap or Gantt view</li>
					<li>Use AI Chat to create or edit events</li>
				</ul>
			</section>

			<section className="prisma-pro-welcome-cta">
				<p>
					Prisma is in active development and improving continuously. Your feedback directly shapes what gets built
					next.
				</p>
				<p>
					If you run into issues, have ideas, or want to share how you use Prisma — reach out or open a{" "}
					<a
						href={proUtm("https://github.com/Real1tyy/Prisma-Calendar/issues", "feedback_inline")}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub issue
					</a>
					.
				</p>
				<p>
					You can manage your subscription anytime from your{" "}
					<a href={proUtm(ACCOUNT_URL, "account_inline")} target="_blank" rel="noopener noreferrer">
						account page
					</a>
					, or from <strong>Settings → License</strong>.
				</p>
			</section>
		</WelcomeModalShell>
	);
});

function HighlightCard({ title, desc }: { title: string; desc: string }) {
	return (
		<div className="prisma-pro-welcome-highlight-card">
			<span className="prisma-pro-welcome-highlight-title">{title}</span>
			<span className="prisma-pro-welcome-highlight-desc">{desc}</span>
		</div>
	);
}

export function showProWelcomeModal(app: App): void {
	showReactModal({
		app,
		cls: "prisma-welcome-modal",
		testId: "prisma-pro-welcome-modal",
		render: (close) => <ProWelcomeController onSubmit={close} />,
	});
}
