import { memo } from "react";

import { useScopedStyles } from "../../hooks/styles/use-styles";
import { OutboundLink } from "../../primitives/atoms/outbound-link";
import { Toggle } from "../../primitives/controls/toggle";
import { SettingItem } from "../../primitives/layout/setting-item";
import { testIdAttr } from "../../utils/test-id";
import { buildPrivacyDisclaimerStyles } from "./privacy-disclaimer.styles";

/**
 * The one copy every observability surface shows — Logs viewer, Doctor export,
 * bug report, the critical-failure prompt, and the logging / feedback settings
 * sections. Exported so a surface's test can assert the exact text without
 * duplicating it; no surface writes its own disclaimer.
 * See [[decision-observability-privacy-posture]].
 */
export const PRIVACY_DISCLAIMER_COPY = {
	summary:
		"Logs are high-level and about the plugin's behaviour. Paths and note names are abbreviated and secrets are never included. Nothing is sent without your explicit action — you can review exactly what's attached.",
	linkLabel: "What is collected and how it is redacted",
	exampleLabel: "See a redaction example",
	exampleBefore: "Private: C:\\Users\\Ana\\Project Atlas\\Clients\\Northwind\\Roadmap.md",
	exampleAfter: "Shared: vault://{91ad3e}/{6f802b}/{c4e59a}.md",
	exampleDescription:
		"Folder and note names become stable tokens; property values are replaced by their type; secrets are removed. Open the privacy page for a complete before-and-after bundle.",
	fullDetailLabel: "Include full detail",
	fullDetailDescription:
		"Keeps real paths, note names and property values so a trusted helper can follow along. Secrets are still removed. Share full detail only with someone you trust.",
} as const;

export interface PrivacyDisclaimerProps {
	/** The plugin's privacy page (already UTM-tracked). */
	docsUrl: string;
	/**
	 * Current "include full detail" state. The toggle renders only when both
	 * this and `onFullDetailChange` are supplied — a settings section that has
	 * no export of its own shows the disclaimer alone.
	 */
	fullDetail?: boolean | undefined;
	onFullDetailChange?: ((value: boolean) => void) | undefined;
	/** `banner` (default): a callout above a surface. `inline`: the compact form for a settings section. */
	variant?: "banner" | "inline" | undefined;
	testId?: string | undefined;
}

export const PrivacyDisclaimer = memo(function PrivacyDisclaimer({
	docsUrl,
	fullDetail,
	onFullDetailChange,
	variant = "banner",
	testId,
}: PrivacyDisclaimerProps) {
	const { cls, tid } = useScopedStyles("privacy-disclaimer", buildPrivacyDisclaimerStyles);

	return (
		<div
			className={variant === "inline" ? `${cls()} ${cls("inline")}` : cls()}
			role="note"
			aria-label="Privacy"
			{...testIdAttr(testId ?? tid())}
		>
			<p className={cls("summary")}>
				{PRIVACY_DISCLAIMER_COPY.summary}{" "}
				<OutboundLink href={docsUrl} className={cls("link")} testId={tid("link")}>
					{`${PRIVACY_DISCLAIMER_COPY.linkLabel} ↗`}
				</OutboundLink>
			</p>
			<details className={cls("example")}>
				<summary>{PRIVACY_DISCLAIMER_COPY.exampleLabel}</summary>
				<p>
					<code>{PRIVACY_DISCLAIMER_COPY.exampleBefore}</code>
					<br />
					<code>{PRIVACY_DISCLAIMER_COPY.exampleAfter}</code>
				</p>
				<p>{PRIVACY_DISCLAIMER_COPY.exampleDescription}</p>
			</details>
			{fullDetail !== undefined && onFullDetailChange !== undefined && (
				<SettingItem
					name={PRIVACY_DISCLAIMER_COPY.fullDetailLabel}
					description={PRIVACY_DISCLAIMER_COPY.fullDetailDescription}
					testId={tid("full-detail")}
				>
					<Toggle value={fullDetail} onChange={onFullDetailChange} testId={tid("full-detail-toggle")} />
				</SettingItem>
			)}
		</div>
	);
});
