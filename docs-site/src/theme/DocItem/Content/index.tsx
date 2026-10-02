// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is synced
// into every */docs-site/src by `mise run sync-docs-site-theme`. Edit it there.
//
// A Docusaurus "wrap" swizzle: every doc renders exactly as before, and the
// changelog doc alone gains the version navigator above its content.

import { useDoc } from "@docusaurus/plugin-content-docs/client";
import type { WrapperProps } from "@docusaurus/types";
import Content from "@theme-original/DocItem/Content";
import type ContentType from "@theme/DocItem/Content";
import { useRef, type ReactNode } from "react";

import ChangelogNavigator from "../../../components/ChangelogNavigator";

type Props = WrapperProps<typeof ContentType>;

const CHANGELOG_DOC_ID = "changelog";

export default function ContentWrapper(props: Props): ReactNode {
	const { metadata } = useDoc();
	const contentRef = useRef<HTMLDivElement>(null);

	if (metadata.id !== CHANGELOG_DOC_ID) return <Content {...props} />;

	return (
		<div ref={contentRef}>
			<ChangelogNavigator contentRef={contentRef} />
			<Content {...props} />
		</div>
	);
}
