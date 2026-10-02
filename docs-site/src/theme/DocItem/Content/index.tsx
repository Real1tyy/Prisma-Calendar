// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is
// synced into every plugin's docs-site/src by `mise run sync-docs-site-theme`. Edit it there.
//
// A Docusaurus "wrap" swizzle: every doc renders exactly as before, and the
// changelog doc alone gains the version navigator above its content.

import { useLocation } from "@docusaurus/router";
import type { WrapperProps } from "@docusaurus/types";
import useBaseUrl from "@docusaurus/useBaseUrl";
import type ContentType from "@theme/DocItem/Content";
import Content from "@theme-original/DocItem/Content";
import { useRef, type ReactNode } from "react";

import ChangelogNavigator from "../../../components/ChangelogNavigator";

type Props = WrapperProps<typeof ContentType>;

// Matched by route rather than `useDoc()`: the sites don't depend on
// @docusaurus/plugin-content-docs directly, and pnpm won't resolve its
// `/client` export for them. Every site serves docs at `/`.
const CHANGELOG_PATH = "/changelog";

export default function ContentWrapper(props: Props): ReactNode {
	const { pathname } = useLocation();
	const changelogPath = useBaseUrl(CHANGELOG_PATH);
	const contentRef = useRef<HTMLDivElement>(null);

	if (pathname.replace(/\/$/, "") !== changelogPath) return <Content {...props} />;

	return (
		<div ref={contentRef}>
			<ChangelogNavigator contentRef={contentRef} />
			<Content {...props} />
		</div>
	);
}
