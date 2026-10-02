export function buildWhatsNewStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}whats-new-modal {
	max-width: 750px;
	width: 90%;
	height: 80vh;
}
.${p}whats-new-modal .modal-title {
	text-align: center;
	width: 100%;
}
.${p}whats-new-modal .modal-content {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	height: 100%;
}
.${p}whats-new-modal .modal-content > [data-testid] {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}
.${p}whats-new-plugin-name {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
	font-weight: 600;
}
.${p}whats-new-plugin-name:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}whats-new-plugin-name::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}whats-new-plugin-name:hover::after {
	width: 100%;
}
.${p}whats-new-subtitle {
	color: var(--text-muted);
	font-size: 0.9rem;
	margin: 0 0 1rem;
}
.${p}whats-new-support {
	flex-shrink: 0;
	margin: 0;
	padding: 1rem 1.1rem;
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--background-secondary) 85%, var(--interactive-accent) 15%),
		var(--background-secondary) 70%
	);
	border-radius: 8px;
	border: 1px solid color-mix(in srgb, var(--interactive-accent) 15%, transparent);
}
.${p}whats-new-support-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	cursor: pointer;
	user-select: none;
}
.${p}whats-new-support-header h3 {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	color: var(--text-accent);
}
.${p}whats-new-support-chevron {
	font-size: 0.7rem;
	color: var(--text-muted);
	transition: transform 0.15s ease;
	flex-shrink: 0;
	padding: 0.2rem;
}
.${p}whats-new-support-body {
	margin-top: 0.5rem;
	overflow: hidden;
	transition: max-height 0.2s ease, opacity 0.2s ease;
	max-height: 500px;
	opacity: 1;
}
.${p}whats-new-support-collapsed {
	max-height: 0;
	opacity: 0;
	margin-top: 0;
}
.${p}whats-new-support p {
	margin: 0.5rem 0;
	color: var(--text-normal);
}
.${p}whats-new-support .${p}whats-new-trial-highlight {
	display: inline-block;
	margin-top: 0.4rem;
	padding: 0.2rem 0.5rem;
	background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
	border: 1px solid color-mix(in srgb, var(--interactive-accent) 20%, transparent);
	border-radius: 5px;
	font-weight: 500;
	font-size: 0.85rem;
	color: var(--text-accent);
}
.${p}whats-new-support a {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
}
.${p}whats-new-support a:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}whats-new-support a::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}whats-new-support a:hover::after {
	width: 100%;
}
.${p}whats-new-content {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	margin-bottom: 1rem;
	padding-right: 0.5rem;
	border-radius: 8px;
}
.${p}whats-new-content h2 {
	font-size: 1.3rem;
	margin-top: 1.5rem;
	margin-bottom: 0.5rem;
	color: var(--text-accent);
}
.${p}whats-new-content h3 {
	font-size: 1.1rem;
	margin-top: 1rem;
	margin-bottom: 0.5rem;
}
.${p}whats-new-content ul { padding-left: 1.5rem; }
.${p}whats-new-content li { margin-bottom: 0.5rem; line-height: 1.6; }
.${p}whats-new-content code {
	background: var(--code-background);
	padding: 0.2em 0.4em;
	border-radius: 3px;
	font-size: 0.9em;
}
.${p}whats-new-modal .${p}whats-new-content code {
	color: var(--code-normal, var(--text-normal));
}
.${p}whats-new-content pre {
	background: var(--code-background);
	padding: 1rem;
	border-radius: 6px;
	overflow-x: auto;
}
.${p}whats-new-modal .${p}whats-new-content a { color: var(--link-color); }
.${p}whats-new-modal .${p}whats-new-content a.external-link {
	color: var(--link-external-color, var(--link-color));
}
.${p}whats-new-content a.external-link::after {
	content: "\\2197";
	margin-left: 0.2em;
	font-size: 0.8em;
}
.${p}whats-new-empty {
	text-align: center;
	color: var(--text-muted);
	padding: 2rem;
	font-style: italic;
}
.${p}whats-new-version-header {
	flex-shrink: 0;
	position: relative;
	margin: 1rem 0 0.75rem;
	padding-bottom: 0.75rem;
	border-bottom: 1px solid var(--background-modifier-border);
}
.${p}whats-new-nav {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
}
.${p}whats-new-scroll-buttons {
	position: absolute;
	top: 0;
	right: 0;
	display: flex;
	gap: 0.35rem;
}
.${p}whats-new-scroll-buttons button {
	padding: 0.25rem 0.6rem;
	font-size: 0.95rem;
	line-height: 1;
}
@media (max-width: 480px) {
	.${p}whats-new-scroll-buttons {
		position: static;
		justify-content: center;
		margin-top: 0.5rem;
	}
}
.${p}whats-new-support-header h3 a.${p}whats-new-support-link {
	color: inherit;
}
.${p}whats-new-nav-arrow {
	font-size: 1.3rem;
	line-height: 1;
	padding: 0.3rem 0.8rem;
}
.${p}whats-new-nav-arrow:disabled {
	opacity: 0.35;
	cursor: default;
}
.${p}whats-new-picker-field {
	position: relative;
}
.${p}whats-new-picker {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.15rem;
}
.${p}whats-new-picker-input {
	width: 9rem;
	text-align: center;
	font-size: 1.1rem;
	font-weight: 600;
	color: var(--text-accent);
}
.${p}whats-new-nav-position {
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}
.${p}whats-new-picker-list {
	position: absolute;
	top: calc(100% + 2px);
	left: 50%;
	transform: translateX(-50%);
	z-index: 20;
	width: 11rem;
	max-height: 16rem;
	overflow-y: auto;
	margin: 0;
	padding: 0.25rem;
	list-style: none;
	background: var(--background-primary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	box-shadow: var(--shadow-s);
}
.${p}whats-new-picker-option,
.${p}whats-new-picker-empty {
	padding: 0.3rem 0.6rem;
	border-radius: 4px;
	text-align: center;
}
.${p}whats-new-picker-option {
	cursor: pointer;
}
.${p}whats-new-picker-option:hover,
.${p}whats-new-picker-option-active {
	background: var(--background-modifier-hover);
}
.${p}whats-new-picker-empty {
	color: var(--text-muted);
	font-style: italic;
}
.${p}whats-new-video {
	margin: 0.5rem 0 1rem;
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	padding: 0.6rem 0.8rem;
	background: var(--background-secondary);
}
.${p}whats-new-video-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}
.${p}whats-new-video-toggle {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	background: none;
	border: none;
	box-shadow: none;
	padding: 0;
	cursor: pointer;
	color: var(--text-accent);
	font-weight: 600;
	font-size: 1rem;
}
.${p}whats-new-video-link {
	font-size: var(--font-ui-small);
}
.${p}whats-new-video-frame {
	margin-top: 0.6rem;
	position: relative;
	aspect-ratio: 16 / 9;
	width: 100%;
}
.${p}whats-new-video-frame iframe,
.${p}whats-new-video-thumbnail {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border: none;
	border-radius: 6px;
}
.${p}whats-new-video-thumbnail {
	padding: 0;
	overflow: hidden;
	cursor: pointer;
	background: #000;
}
.${p}whats-new-video-thumbnail img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}
.${p}whats-new-video-play {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 3.5rem;
	height: 3.5rem;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.4rem;
	color: #fff;
	background: rgb(0 0 0 / 65%);
}
.${p}whats-new-video-thumbnail:hover .${p}whats-new-video-play {
	background: var(--interactive-accent);
}
.${p}whats-new-status {
	text-align: center;
	color: var(--text-muted);
	padding: 2rem 1rem;
}
.${p}whats-new-sticky-footer {
	flex-shrink: 0;
	position: sticky;
	bottom: 0;
	background: var(--background-primary);
	padding-top: 0.75rem;
	margin-top: 0;
	z-index: 10;
	border-top: 1px solid var(--background-modifier-border);
}
.${p}whats-new-buttons {
	display: flex;
	gap: 0.5rem;
	justify-content: space-between;
	flex-wrap: wrap;
	padding-bottom: 0.5rem;
	width: 100%;
}
.${p}whats-new-buttons button {
	flex: 1;
	min-width: 0;
	padding: 0.5rem 1rem;
	border-radius: 4px;
	cursor: pointer;
	border: 1px solid var(--background-modifier-border);
	background: var(--interactive-normal);
	color: var(--text-normal);
	transition: all 0.2s ease;
	text-align: center;
}
.${p}whats-new-buttons button:hover {
	background: var(--interactive-hover);
	border-color: var(--interactive-accent);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.${p}whats-new-buttons button:active {
	transform: translateY(0);
	box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}
`;
}
