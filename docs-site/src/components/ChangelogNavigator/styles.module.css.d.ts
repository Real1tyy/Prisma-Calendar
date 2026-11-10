// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is synced
// into every */docs-site by `mise run sync-docs-site-theme`. Edit it there.
//
// Types the CSS-module import without @docusaurus/module-type-aliases, which is absent
// wherever the site's dependencies are not installed (the public mirror Obsidian's
// reviewer lints). A resolved sibling file outranks that package's `*.module.css`
// pattern, so the two never conflict.

declare const styles: { readonly [className: string]: string };
export default styles;
