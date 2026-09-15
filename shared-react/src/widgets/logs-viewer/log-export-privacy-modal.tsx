import type { App } from "obsidian";
import { memo } from "react";

import { useScopedTid } from "../../contexts/theme-context";
import { Button } from "../../primitives/atoms/button";
import { ModalDescription } from "../../primitives/atoms/modal-description";
import { openReactModal } from "../../show-react-modal";
import { PRIVACY_DISCLAIMER_COPY, PrivacyDisclaimer } from "../privacy-disclaimer/privacy-disclaimer";

export type LogExportAction = "copy" | "save";

export interface LogExportRequest {
	action: LogExportAction;
	count: number;
}

/** Resolves `true` for full detail, `false` for redacted, `null` when the user closed without choosing. */
export type ChooseLogExportDetail = (request: LogExportRequest) => Promise<boolean | null>;

const VERB: Record<LogExportAction, string> = { copy: "Copy", save: "Save" };

export const LOG_EXPORT_PRIVACY_COPY = {
	title: "Redact these logs?",
	redactedHint: "Redacted is the safe choice for a public GitHub issue or anyone you don't know.",
	fullDetailHint: PRIVACY_DISCLAIMER_COPY.fullDetailDescription,
} as const;

function describeRequest({ action, count }: LogExportRequest): string {
	const entries = `${count} ${count === 1 ? "entry" : "entries"}`;
	return action === "copy"
		? `You are copying ${entries} to the clipboard.`
		: `You are saving ${entries} to a file in your vault.`;
}

export interface LogExportPrivacyContentProps {
	docsUrl: string;
	request: LogExportRequest;
	onChoose: (fullDetail: boolean) => void;
}

/**
 * The moment a log leaves the viewer is the moment privacy matters, so the
 * choice is asked there rather than held as a standing toggle on screen.
 * See [[decision-observability-privacy-posture]].
 */
export const LogExportPrivacyContent = memo(function LogExportPrivacyContent({
	docsUrl,
	request,
	onChoose,
}: LogExportPrivacyContentProps) {
	const tid = useScopedTid("log-export-privacy");
	const verb = VERB[request.action];

	return (
		<div data-testid={tid()}>
			<ModalDescription>{describeRequest(request)}</ModalDescription>
			<PrivacyDisclaimer docsUrl={docsUrl} testId={tid("disclaimer")} />
			<ul>
				<li>
					<strong>{`${verb} redacted`}</strong>
					{` — ${LOG_EXPORT_PRIVACY_COPY.redactedHint}`}
				</li>
				<li>
					<strong>{`${verb} with full detail`}</strong>
					{` — ${LOG_EXPORT_PRIVACY_COPY.fullDetailHint}`}
				</li>
			</ul>
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={tid("full-detail")} onClick={() => onChoose(true)}>
					{`${verb} with full detail`}
				</Button>
				<Button testId={tid("redacted")} variant="primary" onClick={() => onChoose(false)}>
					{`${verb} redacted`}
				</Button>
			</div>
		</div>
	);
});

export interface OpenLogExportPrivacyModalConfig {
	docsUrl: string;
	cssPrefix: string;
	request: LogExportRequest;
}

export function openLogExportPrivacyModal(app: App, config: OpenLogExportPrivacyModalConfig): Promise<boolean | null> {
	return openReactModal<boolean>({
		app,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		cls: `${config.cssPrefix}log-export-privacy-modal`,
		title: LOG_EXPORT_PRIVACY_COPY.title,
		render: (submit) => <LogExportPrivacyContent docsUrl={config.docsUrl} request={config.request} onChoose={submit} />,
	});
}
