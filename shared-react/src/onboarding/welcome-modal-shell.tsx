import type { ReactNode } from "react";

import { Button } from "../components/button";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { buildWelcomeShellStyles } from "./welcome-modal-shell.styles";

export interface WelcomeModalFooterLink {
	label: string;
	href: string;
}

export interface WelcomeModalShellProps {
	cssPrefix: string;
	title?: string | undefined;
	tagline?: ReactNode | undefined;
	videoEmbedUrl?: string | undefined;
	videoCaption?: string | undefined;
	footerLinks?: WelcomeModalFooterLink[] | undefined;
	submitDisabled?: boolean | undefined;
	testIdPrefix?: string | undefined;
	onSubmit: () => void;
	children: ReactNode;
}

function openExternal(href: string): void {
	window.open(href, "_blank", "noopener,noreferrer");
}

export function WelcomeModalShell({
	cssPrefix,
	title,
	tagline,
	videoEmbedUrl,
	videoCaption,
	footerLinks,
	submitDisabled,
	testIdPrefix,
	onSubmit,
	children,
}: WelcomeModalShellProps) {
	useInjectedStyles(`${cssPrefix}-welcome-shell-styles`, buildWelcomeShellStyles(cssPrefix));
	const tid = (suffix: string) => `${testIdPrefix ?? `${cssPrefix}-welcome`}-${suffix}`;

	return (
		<div className={`${cssPrefix}-welcome-root`}>
			{title ? <h2 className={`${cssPrefix}-welcome-title`}>{title}</h2> : null}
			{tagline ? <div className={`${cssPrefix}-welcome-tagline`}>{tagline}</div> : null}
			{tagline ? <hr className={`${cssPrefix}-welcome-divider`} /> : null}

			{videoEmbedUrl ? (
				<section className={`${cssPrefix}-welcome-video`}>
					<iframe
						className={`${cssPrefix}-welcome-video-frame`}
						src={videoEmbedUrl}
						title="Welcome video"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
					/>
					{videoCaption ? <p className={`${cssPrefix}-welcome-video-caption`}>{videoCaption}</p> : null}
				</section>
			) : null}

			{videoEmbedUrl ? <hr className={`${cssPrefix}-welcome-divider`} /> : null}

			{children}

			<div className={`${cssPrefix}-welcome-footer`}>
				<div className={`${cssPrefix}-welcome-footer-links`}>
					{footerLinks?.map((link) => (
						<button
							key={`${link.label}-${link.href}`}
							type="button"
							className={`${cssPrefix}-welcome-link-button`}
							onClick={() => openExternal(link.href)}
							data-testid={tid(`footer-${link.label.replace(/[^\w-]+/g, "-").toLowerCase()}`)}
						>
							{link.label}
						</button>
					))}
				</div>
				<div className={`${cssPrefix}-welcome-actions`}>
					<Button testId={tid("submit")} variant="primary" disabled={submitDisabled} onClick={onSubmit}>
						Continue
					</Button>
				</div>
			</div>
		</div>
	);
}
