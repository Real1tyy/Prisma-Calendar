import {
	acceptScreenshot,
	buildFeedbackSubmission,
	FEEDBACK_MAX_SCREENSHOTS,
	FEEDBACK_TYPES,
	serializeForExport,
	type DebugBundle,
	type FeedbackSubmission,
	type FeedbackType,
	type ScreenshotAttachment,
	type SubmissionResult,
} from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";
import { memo, useCallback, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { showReactModal } from "../show-react-modal";
import { cx } from "../utils/cx";
import { PrivacyDisclaimer } from "../widgets/privacy-disclaimer/privacy-disclaimer";
import { buildFeedbackStyles } from "./feedback-modal.styles";

const TYPE_LABELS: Record<FeedbackType, string> = {
	bug: "Bug report",
	feature: "Feature request",
	general: "Feedback",
};

const TYPE_PLACEHOLDERS: Record<FeedbackType, string> = {
	bug: "What did you do, what happened, and what did you expect instead?",
	feature: "What would you like to be able to do, and what would it let you get done?",
	general: "What's on your mind?",
};

/** `form` collects, `sending` is in flight, `sent` is terminal — and terminal is what blocks a double submit. */
type Phase = "form" | "sending" | "sent";

export interface FeedbackModalProps {
	pluginDisplayName: string;
	/** UTM-tracked privacy page. Omitted when the plugin publishes none, which hides the disclaimer. */
	privacyUrl?: string | undefined;
	/**
	 * Snapshots the debug context. Omitted when the plugin wired no log service —
	 * then there is nothing to attach and the checkbox does not render.
	 */
	captureDebugBundle?: (() => DebugBundle) | undefined;
	/** Whether this verified Pro install can attach its license key. */
	licenseAttributionAvailable?: boolean | undefined;
	/** Posts the assembled payload. Returns a typed result — it never throws. */
	submit: (submission: FeedbackSubmission, includeLicenseKey: boolean) => Promise<SubmissionResult>;
	onClose: () => void;
}

/** Two pastes of the same clipboard image are indistinguishable, so the render key is minted, not derived. */
type AttachedScreenshot = ScreenshotAttachment & { id: string };

/** Strips the `data:<mime>;base64,` prefix a `FileReader` result carries. */
function base64Of(dataUrl: string): string {
	const comma = dataUrl.indexOf(",");
	return comma === -1 ? "" : dataUrl.slice(comma + 1);
}

function readImage(file: File): Promise<AttachedScreenshot> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
		reader.onload = () =>
			resolve({
				id: crypto.randomUUID(),
				name: file.name,
				mimeType: file.type,
				dataBase64: base64Of(String(reader.result ?? "")),
				byteSize: file.size,
			});
		reader.readAsDataURL(file);
	});
}

export const FeedbackModalContent = memo(function FeedbackModalContent({
	pluginDisplayName,
	privacyUrl,
	captureDebugBundle,
	licenseAttributionAvailable = false,
	submit,
	onClose,
}: FeedbackModalProps) {
	const { cls, tid } = useScopedStyles("feedback", buildFeedbackStyles);
	const [type, setType] = useState<FeedbackType>("bug");
	const [text, setText] = useState("");
	const [includeDebug, setIncludeDebug] = useState(true);
	const [includeLicenseKey, setIncludeLicenseKey] = useState(licenseAttributionAvailable);
	const [fullDetail, setFullDetail] = useState(false);
	const [screenshots, setScreenshots] = useState<AttachedScreenshot[]>([]);
	const [phase, setPhase] = useState<Phase>("form");
	const [error, setError] = useState<string | null>(null);
	const [attachError, setAttachError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// Guards a second click landing in the same tick as the first, before the
	// `sending` phase has re-rendered the disabled button.
	const inFlightRef = useRef(false);

	// Captured once per toggle rather than at send time, so what the user reviews
	// below the checkbox is byte-for-byte what leaves the device.
	const bundle = useMemo(
		() => (includeDebug && captureDebugBundle !== undefined ? captureDebugBundle() : null),
		[includeDebug, captureDebugBundle]
	);

	const chooseType = useCallback((next: FeedbackType) => {
		setType(next);
		// Debug context is what turns "it's broken" into something actionable, so
		// a bug report opts in by default and everything else opts in by hand.
		setIncludeDebug(next === "bug");
	}, []);

	const attach = useCallback(
		async (files: readonly File[]) => {
			if (files.length === 0) return;
			const read = await Promise.all(files.map(readImage));

			// Accept greedily and report the first rejection: dropping three images
			// on a modal that has room for one should still keep that one.
			let next: AttachedScreenshot[] = screenshots;
			let rejected: string | null = null;
			for (const candidate of read) {
				const result = acceptScreenshot(next, candidate);
				if (result.ok) next = result.screenshots;
				else rejected ??= result.message;
			}
			setScreenshots(next);
			setAttachError(rejected);
		},
		[screenshots]
	);

	const handleFileInput = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			void attach(Array.from(event.target.files ?? []));
			// Let the same file be picked again after a removal.
			event.target.value = "";
		},
		[attach]
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const files = Array.from(event.clipboardData?.files ?? []);
			if (files.length === 0) return;
			event.preventDefault();
			void attach(files);
		},
		[attach]
	);

	const removeScreenshot = useCallback((id: string) => {
		setScreenshots((current) => current.filter((shot) => shot.id !== id));
		setAttachError(null);
	}, []);

	const handleSubmit = useCallback(async () => {
		if (text.trim() === "" || inFlightRef.current) return;
		inFlightRef.current = true;
		setPhase("sending");
		setError(null);

		const result = await submit(
			buildFeedbackSubmission({
				type,
				text,
				...(bundle !== null ? { debugBundle: bundle } : {}),
				screenshots,
				fullDetail,
			}),
			licenseAttributionAvailable && includeLicenseKey
		);

		inFlightRef.current = false;
		if (result.ok) {
			setPhase("sent");
			return;
		}
		// Text and attachments stay in state on purpose — a failed send must cost
		// the user nothing, so "Try again" resubmits exactly what they assembled.
		setPhase("form");
		setError(result.message);
	}, [bundle, fullDetail, includeLicenseKey, licenseAttributionAvailable, screenshots, submit, text, type]);

	if (phase === "sent") {
		return (
			<div data-testid={tid("modal")}>
				<div className={cls("thanks")} data-testid={tid("thanks")}>
					<div className={cls("thanks-title")}>Thank you!</div>
					<div className={cls("thanks-body")}>
						{`It's on its way. Every report genuinely shapes what gets built into ${pluginDisplayName} next.`}
					</div>
					<Button variant="primary" onClick={onClose} testId={tid("close")}>
						Close
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div data-testid={tid("modal")} onPaste={handlePaste}>
			<div role="radiogroup" aria-label="What kind of feedback" className={cls("types")} data-testid={tid("types")}>
				{FEEDBACK_TYPES.map((value) => (
					<button
						key={value}
						type="button"
						role="radio"
						aria-checked={type === value}
						className={cx(cls("type"), type === value && cls("type-active"))}
						onClick={() => chooseType(value)}
						data-testid={tid(`type-${value}`)}
					>
						{TYPE_LABELS[value]}
					</button>
				))}
			</div>

			<textarea
				className={cls("text")}
				aria-label="Description"
				placeholder={TYPE_PLACEHOLDERS[type]}
				value={text}
				onChange={(event) => setText(event.target.value)}
				data-testid={tid("text")}
			/>

			{captureDebugBundle !== undefined && (
				<label className={cls("option")}>
					<input
						type="checkbox"
						checked={includeDebug}
						onChange={(event) => setIncludeDebug(event.target.checked)}
						data-testid={tid("include-debug")}
					/>
					<span>Include debug info — recent warnings, errors and the last few minutes of activity</span>
				</label>
			)}

			{licenseAttributionAvailable && (
				<label className={cls("option")}>
					<input
						type="checkbox"
						checked={includeLicenseKey}
						onChange={(event) => setIncludeLicenseKey(event.target.checked)}
						data-testid={tid("include-license")}
					/>
					<span>Include my license key so this report can be linked to my Pro account</span>
				</label>
			)}

			{bundle !== null && (
				<details data-testid={tid("bundle-details")}>
					<summary className={cls("attach-hint")}>Review what's attached</summary>
					<pre className={cls("bundle-preview")} data-testid={tid("bundle-preview")}>
						{serializeForExport(bundle, { fullDetail })}
					</pre>
				</details>
			)}

			{screenshots.length > 0 && (
				<div className={cls("attachments")} data-testid={tid("attachments")}>
					{screenshots.map((shot, index) => (
						<div key={shot.id} className={cls("thumb")} data-testid={tid(`thumb-${index}`)}>
							<img src={`data:${shot.mimeType};base64,${shot.dataBase64}`} alt={shot.name} />
							<button
								type="button"
								className={cls("thumb-remove")}
								aria-label={`Remove ${shot.name}`}
								onClick={() => removeScreenshot(shot.id)}
								data-testid={tid(`thumb-remove-${index}`)}
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}

			<div className={cls("attach-row")}>
				<Button onClick={() => fileInputRef.current?.click()} testId={tid("attach")}>
					Add screenshot
				</Button>
				<span className={cls("attach-hint")}>{`or paste one — up to ${FEEDBACK_MAX_SCREENSHOTS}`}</span>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					aria-label="Add screenshot"
					className={cls("attach-input")}
					onChange={handleFileInput}
					data-testid={tid("attach-input")}
				/>
			</div>

			{attachError !== null && (
				<p className={cls("error")} role="alert" data-testid={tid("attach-error")}>
					{attachError}
				</p>
			)}

			{privacyUrl !== undefined && (
				<PrivacyDisclaimer
					docsUrl={privacyUrl}
					variant="inline"
					// The switch only makes sense next to something that is actually
					// attached — with the bundle off there is nothing to detail.
					{...(bundle !== null ? { fullDetail, onFullDetailChange: setFullDetail } : {})}
					testId={tid("privacy")}
				/>
			)}

			{error !== null && (
				<p className={cls("error")} role="alert" data-testid={tid("error")}>
					{error}
				</p>
			)}

			<div className={cls("actions")}>
				<Button onClick={onClose} testId={tid("cancel")}>
					Cancel
				</Button>
				<Button
					variant="primary"
					disabled={text.trim() === "" || phase === "sending"}
					onClick={() => void handleSubmit()}
					testId={tid("submit")}
				>
					{phase === "sending" ? "Sending…" : error !== null ? "Try again" : "Submit"}
				</Button>
			</div>
		</div>
	);
});

export interface ShowFeedbackModalConfig {
	/** Trailing-dash CSS prefix, e.g. `"prisma-"` — drives the modal class + styles. */
	cssPrefix: string;
	pluginDisplayName: string;
	privacyUrl?: string | undefined;
	captureDebugBundle?: (() => DebugBundle) | undefined;
	licenseAttributionAvailable?: boolean | undefined;
	submit: (submission: FeedbackSubmission, includeLicenseKey: boolean) => Promise<SubmissionResult>;
}

export function showFeedbackReactModal(app: App, config: ShowFeedbackModalConfig): void {
	showReactModal({
		app,
		cls: `${config.cssPrefix}feedback-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: "Send feedback",
		render: (close) => (
			<FeedbackModalContent
				pluginDisplayName={config.pluginDisplayName}
				privacyUrl={config.privacyUrl}
				captureDebugBundle={config.captureDebugBundle}
				licenseAttributionAvailable={config.licenseAttributionAvailable}
				submit={config.submit}
				onClose={close}
			/>
		),
	});
}
