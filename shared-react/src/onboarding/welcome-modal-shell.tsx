import type { ReactNode } from "react";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { buildWelcomeShellStyles } from "./welcome-modal-shell.styles";

export interface WelcomeModalFooterLink {
	label: string;
	href: string;
}

export interface WelcomeModalShellProps {
	title?: string | undefined;
	tagline?: ReactNode | undefined;
	videoEmbedUrl?: string | undefined;
	videoCaption?: string | undefined;
	footerLinks?: WelcomeModalFooterLink[] | undefined;
	submitDisabled?: boolean | undefined;
	onSubmit: () => void;
	children: ReactNode;
}

function openExternal(href: string): void {
	window.open(href, "_blank", "noopener,noreferrer");
}

function slugify(label: string): string {
	return label.replace(/[^\w-]+/g, "-").toLowerCase();
}

export function WelcomeModalShell({
	title,
	tagline,
	videoEmbedUrl,
	videoCaption,
	footerLinks,
	submitDisabled,
	onSubmit,
	children,
}: WelcomeModalShellProps) {
	const { cls, tid } = useScopedStyles("welcome", buildWelcomeShellStyles);

	return (
		<div className={cls("root")}>
			{title ? <h2 className={cls("title")}>{title}</h2> : null}
			{tagline ? <div className={cls("tagline")}>{tagline}</div> : null}
			{tagline ? <hr className={cls("divider")} /> : null}

			{videoEmbedUrl ? (
				<section className={cls("video")}>
					<iframe
						className={cls("video-frame")}
						src={videoEmbedUrl}
						title="Welcome video"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
					/>
					{videoCaption ? <p className={cls("video-caption")}>{videoCaption}</p> : null}
				</section>
			) : null}

			{videoEmbedUrl ? <hr className={cls("divider")} /> : null}

			{children}

			<div className={cls("footer")}>
				<div className={cls("footer-links")}>
					{footerLinks?.map((link) => (
						<button
							key={`${link.label}-${link.href}`}
							type="button"
							className={cls("link-button")}
							onClick={() => openExternal(link.href)}
							data-testid={tid("footer", slugify(link.label))}
						>
							{link.label}
						</button>
					))}
				</div>
				<div className={cls("actions")}>
					<Button testId={tid("submit")} variant="primary" disabled={submitDisabled} onClick={onSubmit}>
						Continue
					</Button>
				</div>
			</div>
		</div>
	);
}
