# Documentation Guidelines

## Tone and Style

- **Matter of fact.** State what something does, not how exciting it is.
- **Concise.** If two sentences cover it, don't write five. Every sentence must earn its place.
- **Complete.** Include all necessary details — concise does not mean incomplete.

## DRY — Don't Repeat Yourself

- Never duplicate content that exists on another page. Link to it instead.
- Interlink heavily between documentation pages. If a concept is explained elsewhere, write one sentence and link.
- If you find yourself writing the same paragraph in two places, extract it to one and reference it from the other.

## Scope — User Experience Only

- Document what the user sees and does. Do not explain internal implementation, technical architecture, or code-level details.
- No "Technical Details" sections. Users don't care how it works under the hood.
- Keep everything at the user-experience level: what it is, how to configure it, what the options do.

## No Unsolicited Tips or Examples

- Do not add "Example Use Cases", "Tips", or "Pro Tips" sections unless the feature genuinely requires them to be understood.
- Do not be opinionated about how users should use a feature. Document what it does and let users decide.
- Usage examples are only warranted when the feature's behavior is non-obvious without one (e.g., frontmatter syntax, expression filters).

## Structure

- Start with a one-line summary under the heading.
- Follow with a short overview if needed (2-3 sentences max).
- Use sections for configuration, behavior, and precedence rules — whatever applies.
- Use tables for comparison or precedence when there are 3+ items.

## Changelog

- Every feature or fix requires a changelog entry in `docs-site/docs/changelog.md`.
- Write under the latest version already present, updating the date if needed.
- Only create a new version section when explicitly told to.
- Changelog entries are one paragraph: bold feature name, then a concise description of what was added/changed/fixed. Link to the feature doc page at the end.

## Documentation Pages

- Every new user-facing feature gets a page in `docs-site/docs/features/`.
- Add the page to `docs-site/sidebars.ts`.
- Add a corresponding entry in `docs-site/docs/configuration.md` under the relevant settings section if the feature has configurable settings.
