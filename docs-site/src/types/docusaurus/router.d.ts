// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is synced
// into every */docs-site by `mise run sync-docs-site-theme`. Edit it there.
//
// The slice of `@docusaurus/router` the theme uses, reached through tsconfig `paths`.
// Docusaurus types this module only via @docusaurus/module-type-aliases, which is absent
// wherever the site's dependencies are not installed — the public mirror Obsidian's
// reviewer lints included — and an unresolved hook types as an error, so every call
// reads as `no-unsafe-*`. A non-pattern ambient declaration outranks `paths`, so where
// Docusaurus IS installed its own types still win.

export interface Location {
	pathname: string;
	search: string;
	hash: string;
}

export interface LocationDescriptor {
	pathname?: string;
	search?: string;
	hash?: string;
}

export interface History {
	location: Location;
	push(location: string | LocationDescriptor): void;
	replace(location: string | LocationDescriptor): void;
}

export declare function useLocation(): Location;
export declare function useHistory(): History;
