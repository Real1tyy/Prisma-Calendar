import type { NoticeLink } from "@real1ty/obsidian-plugins";
import { memo } from "react";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { OutboundLink } from "../primitives/atoms/outbound-link";
import { buildLinkNoticeStyles } from "./link-notice.styles";

export interface LinkNoticeProps {
	message: string;
	links?: readonly NoticeLink[] | undefined;
}

function labelSlug(label: string): string {
	return label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Body of a notice that ends in one or more outbound links. Renders each link
 * as its label only — the href (UTM params and all) is never shown as text,
 * because a raw tracking URL in a toast is unreadable and, since a notice is
 * not selectable, not even copyable.
 */
export const LinkNotice = memo(function LinkNotice({ message, links }: LinkNoticeProps) {
	const { cls, tid } = useScopedStyles("link-notice", buildLinkNoticeStyles);

	return (
		<div className={cls()} data-testid={tid()}>
			<div className={cls("message")}>{message}</div>
			{links && links.length > 0 && (
				<div className={cls("actions")}>
					{links.map((link) => (
						<OutboundLink
							key={link.href}
							href={link.href}
							className={cls("link")}
							testId={tid("link", labelSlug(link.label))}
						>
							{link.label}
						</OutboundLink>
					))}
				</div>
			)}
		</div>
	);
});
