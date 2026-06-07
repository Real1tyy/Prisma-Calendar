import { memo, type CSSProperties, type ReactNode } from "react";

import { testIdAttr } from "../../utils/test-id";

export interface OutboundLinkProps {
	/** Fully-resolved destination URL (apply UTM before passing it in). */
	href: string;
	children: ReactNode;
	className?: string | undefined;
	style?: CSSProperties | undefined;
	testId?: string | undefined;
	/** Accessible label when the visible content is an icon/glyph only. */
	ariaLabel?: string | undefined;
}

/**
 * The single home for outbound `<a>` links across every plugin — bakes in
 * `target="_blank"` + `rel="noopener noreferrer"` so those attributes are never
 * hand-repeated. It does NOT build UTM params; pass an already-tracked `href`
 * (see each plugin's `settingsDocUrl`-style helper, or `buildUtmUrl`).
 */
export const OutboundLink = memo(function OutboundLink({
	href,
	children,
	className,
	style,
	testId,
	ariaLabel,
}: OutboundLinkProps) {
	return (
		<a
			href={href}
			className={className}
			style={style}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={ariaLabel}
			{...testIdAttr(testId)}
		>
			{children}
		</a>
	);
});
