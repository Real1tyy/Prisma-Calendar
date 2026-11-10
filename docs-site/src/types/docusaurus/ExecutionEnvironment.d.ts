// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is synced
// into every */docs-site by `mise run sync-docs-site-theme`. Edit it there.
//
// Why a local declaration at all: see ./router.d.ts.

declare const ExecutionEnvironment: {
	readonly canUseDOM: boolean;
	readonly canUseEventListeners: boolean;
	readonly canUseIntersectionObserver: boolean;
	readonly canUseViewport: boolean;
};

export default ExecutionEnvironment;
