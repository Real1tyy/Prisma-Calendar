export function buildProgressStyles(p: string): string {
	return `
.${p}progress-modal { padding: 2rem; min-width: 400px; }
.${p}progress-modal h2 { margin: 0 0 2.5rem 0; font-size: 1.8rem; font-weight: 600; text-align: center; color: var(--text-normal); }
.${p}progress-status { font-size: 1.3rem; font-weight: 600; color: var(--text-normal); margin-bottom: 1.5rem; text-align: center; letter-spacing: 0.3px; }
.${p}progress-container { width: 100%; height: 40px; background: var(--background-secondary); border-radius: 20px; overflow: hidden; margin-bottom: 2rem; border: 2px solid var(--background-modifier-border); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1); }
.${p}progress-bar { height: 100%; background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover)); transition: width 0.3s ease; border-radius: 20px; box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3); }
.${p}progress-complete { --${p}success-rgb: 76, 175, 80; background: linear-gradient(90deg, rgb(var(--${p}success-rgb)), rgb(102, 187, 106)); box-shadow: 0 2px 8px rgba(var(--${p}success-rgb), 0.3); }
.${p}progress-error { --${p}error-rgb: 244, 67, 54; background: linear-gradient(90deg, rgb(var(--${p}error-rgb)), rgb(239, 83, 80)); box-shadow: 0 2px 8px rgba(var(--${p}error-rgb), 0.3); }
.${p}progress-details { font-size: 1.1rem; color: var(--text-muted); text-align: center; min-height: 2rem; word-break: break-word; line-height: 1.5; }
`;
}
