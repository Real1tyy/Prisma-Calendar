import { getObsidianLinkAlias, getObsidianLinkPath, isObsidianLink } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Fragment, memo, type MouseEvent } from "react";

import { useApp } from "../../contexts/app-context";

export interface PropertyValueProps {
	/** Frontmatter value to render — string, number, array, etc. */
	value: unknown;
	/** CSS class applied to rendered `<a>` link elements. */
	linkClassName?: string | undefined;
	/** Called after a link is opened — typically used to close the host modal/dropdown. */
	onLinkClick?: (() => void) | undefined;
}

interface PropertyLinkProps {
	raw: string;
	app: App;
	linkClassName?: string | undefined;
	onLinkClick?: (() => void) | undefined;
}

function PropertyLink({ raw, app, linkClassName, onLinkClick }: PropertyLinkProps) {
	const path = getObsidianLinkPath(raw);
	const text = getObsidianLinkAlias(raw);
	const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault();
		e.stopPropagation();
		void app.workspace.openLinkText(path, "", false);
		onLinkClick?.();
	};
	return (
		<a className={linkClassName} onClick={handleClick}>
			{text}
		</a>
	);
}

/**
 * Declarative React renderer for an Obsidian frontmatter property value.
 *  - obsidian wiki-links → clickable `<a>` that opens the link
 *  - arrays of wiki-links → rendered with `, ` separators
 *  - plain arrays → joined with `, `
 *  - everything else → trimmed `String(value)`
 *
 * Pulls the Obsidian `App` from `AppContext` — must be rendered under an
 * `AppContext` provider (every shared-react mount bridge already wires this).
 */
export const PropertyValue = memo(function PropertyValue({ value, linkClassName, onLinkClick }: PropertyValueProps) {
	const app = useApp();

	if (Array.isArray(value)) {
		if (!value.some(isObsidianLink)) {
			return <>{value.join(", ")}</>;
		}
		return (
			<>
				{value.map((item, i) => {
					const raw = String(item).trim();
					return (
						// oxlint-disable-next-line react/no-array-index-key -- stateless inline list; position drives the comma separator below
						<Fragment key={i}>
							{i > 0 && ", "}
							{isObsidianLink(raw) ? (
								<PropertyLink raw={raw} app={app} linkClassName={linkClassName} onLinkClick={onLinkClick} />
							) : (
								raw
							)}
						</Fragment>
					);
				})}
			</>
		);
	}

	const raw = String(value).trim();
	if (isObsidianLink(raw)) {
		return <PropertyLink raw={raw} app={app} linkClassName={linkClassName} onLinkClick={onLinkClick} />;
	}
	return raw;
});
