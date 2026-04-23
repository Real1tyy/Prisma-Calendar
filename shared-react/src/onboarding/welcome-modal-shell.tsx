import type { ReactNode } from "react";

import { Button } from "../components/button";
import { useInjectedStyles } from "../hooks/use-injected-styles";

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

function buildStyles(prefix: string): string {
	return `
.${prefix}-welcome-modal {
	max-width: 980px;
	width: min(980px, 94vw);
}

.${prefix}-welcome-root {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	color: var(--text-normal);
}

.${prefix}-welcome-title {
	margin: 0;
	font-size: 1.85rem;
	text-align: center;
	font-weight: 700;
	line-height: 1.15;
	color: var(--text-normal);
	letter-spacing: -0.03em;
}

.${prefix}-welcome-tagline {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	margin: 0;
	padding: 0.85rem 1.1rem;
	border-left: 3px solid var(--interactive-accent);
	border-radius: 0 10px 10px 0;
	background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-secondary));
}

.${prefix}-welcome-divider {
	border: none;
	border-top: 1px solid var(--background-modifier-border);
	margin: 0;
}

.${prefix}-welcome-video {
	display: flex;
	flex-direction: column;
	gap: 0.65rem;
	padding: 1rem 1.1rem;
	border: 1px solid var(--background-modifier-border);
	border-radius: 16px;
	background: var(--background-secondary);
}

.${prefix}-welcome-video-frame {
	width: 100%;
	aspect-ratio: 16 / 9;
	border: 0;
	border-radius: 12px;
	background: #000;
}

.${prefix}-welcome-video-caption {
	margin: 0;
	color: var(--text-muted);
	font-size: 0.9rem;
	line-height: 1.45;
	text-align: center;
}

.${prefix}-welcome-footer {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.85rem;
	padding-top: 1.25rem;
	margin-top: 0.5rem;
	border-top: 1px solid var(--background-modifier-border);
}

.${prefix}-welcome-footer-links {
	display: flex;
	flex-wrap: wrap;
	gap: 0.55rem;
	flex: 1;
	min-width: 0;
}

.${prefix}-welcome-actions {
	display: flex;
	flex-wrap: nowrap;
	gap: 0.55rem;
	margin-left: auto;
	flex-shrink: 0;
}

.${prefix}-welcome-footer-links .${prefix}-welcome-link-button {
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	border: 1px solid var(--background-modifier-border);
	border-radius: 10px;
	background: var(--background-secondary);
	color: var(--text-normal);
	padding: 0.6rem 1.1rem;
	font-size: 0.95rem;
	line-height: 1;
	cursor: pointer;
	white-space: nowrap;
	text-align: center;
}

.${prefix}-welcome-footer-links .${prefix}-welcome-link-button:hover {
	border-color: var(--interactive-accent);
}

.${prefix}-welcome-actions button {
	padding: 0.6rem 1.1rem;
	font-size: 0.95rem;
}

@media (max-width: 720px) {
	.${prefix}-welcome-footer {
		flex-direction: column;
		align-items: stretch;
	}

	.${prefix}-welcome-footer-links,
	.${prefix}-welcome-actions {
		width: 100%;
	}
}
`;
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
	useInjectedStyles(`${cssPrefix}-welcome-shell-styles`, buildStyles(cssPrefix));
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
