export function buildWelcomeShellStyles(prefix: string): string {
	return `
@keyframes ${prefix}-welcome-fade-in {
	from { opacity: 0; transform: translateY(8px); }
	to { opacity: 1; transform: translateY(0); }
}

@keyframes ${prefix}-welcome-title-glow {
	0%, 100% { text-shadow: 0 0 30px color-mix(in srgb, var(--interactive-accent) 20%, transparent); }
	50% { text-shadow: 0 0 40px color-mix(in srgb, var(--interactive-accent) 35%, transparent); }
}

.${prefix}-welcome-modal {
	max-width: 980px;
	width: min(980px, 94vw);
}

.${prefix}-welcome-root {
	display: flex;
	flex-direction: column;
	gap: 1.15rem;
	color: var(--text-normal);
	animation: ${prefix}-welcome-fade-in 400ms ease-out both;
}

.${prefix}-welcome-title {
	margin: 0;
	padding-top: 0.25rem;
	font-size: 2rem;
	text-align: center;
	font-weight: 800;
	line-height: 1.15;
	letter-spacing: -0.035em;
	background: linear-gradient(
		135deg,
		var(--text-normal) 40%,
		var(--interactive-accent) 100%
	);
	background-clip: text;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	animation: ${prefix}-welcome-title-glow 4s ease-in-out infinite;
}

.${prefix}-welcome-tagline {
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
	margin: 0;
	padding: 1rem 1.25rem;
	border-left: 3px solid var(--interactive-accent);
	border-radius: 0 12px 12px 0;
	background: linear-gradient(
		100deg,
		color-mix(in srgb, var(--interactive-accent) 10%, var(--background-secondary)),
		var(--background-secondary) 80%
	);
}

.${prefix}-welcome-divider {
	border: none;
	border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 70%, var(--interactive-accent) 30%);
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
	box-shadow: 0 2px 12px color-mix(in srgb, var(--background-primary) 60%, transparent);
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
	padding: 0.6rem 1.25rem;
	font-size: 0.95rem;
	font-weight: 600;
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
