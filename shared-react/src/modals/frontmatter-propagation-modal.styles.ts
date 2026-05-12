export function buildFrontmatterPropagationStyles(p: string): string {
	return `
.${p}frontmatter-changes { margin: 1rem 0; }
.${p}frontmatter-changes h4 { margin: 0.75rem 0 0.25rem; font-size: var(--font-ui-small); color: var(--text-muted); }
.${p}frontmatter-changes ul { padding-left: 1.5rem; margin: 0; }
.${p}frontmatter-changes li { margin-bottom: 0.25rem; line-height: 1.5; }
.${p}change-added { color: var(--text-success); }
.${p}change-modified { color: var(--text-accent); }
.${p}change-deleted { color: var(--text-error); }
`;
}
