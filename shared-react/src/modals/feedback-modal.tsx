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
import { ImageLightbox } from "./image-lightbox";

const TYPE_LABELS: Record<FeedbackType, string> = {
	bug: "Bug report",
	feature: "Feature request",
	general: "Feedback",
};

const TYPE_PLACEHOLDERS: Record<FeedbackType, string> = {
	bug: "What were you doing, what happened, and what did you expect instead? Steps that reproduce it help most.",
	feature: "What would you like to be able to do — and what would it let you get done?",
	general: "What's working, what isn't, what would you change?",
};

/** One line under the title, telling the user what this form is for at all. */
const TYPE_INTROS: Record<FeedbackType, string> = {
	bug: "Tell me what went wrong. Reports go straight to me, with the context needed to track it down.",
	feature: "Tell me what's missing. Requests shape what gets built next.",
	general: "Tell me what you think. Every message is read.",
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
	/** Seeds a restored report, or one the screenshot command pre-loaded. */
	initialState?: Partial<FeedbackFormState> | undefined;
	/** Collapses the report, handing its state to the host. Omitted ⇒ no minimize control. */
	onMinimize?: ((state: FeedbackFormState) => void) | undefined;
	/**
	 * Minimizes and starts the screenshot flow. Omitted where capture is
	 * unavailable — mobile — so the control never advertises what can't happen.
	 */
	onCapture?: ((state: FeedbackFormState) => void) | undefined;
	onClose: () => void;
}

/** Two pastes of the same clipboard image are indistinguishable, so the render key is minted, not derived. */
export type AttachedScreenshot = ScreenshotAttachment & { id: string };

/**
 * Everything the user has entered, in one object — because minimize has to hand
 * the whole report to the host and get it back intact, and a field that lives
 * only as a local `useState` is a field that silently doesn't survive
 * ([[spec-feedback-commands-and-screenshot-capture]] R7).
 */
export interface FeedbackFormState {
	type: FeedbackType;
	text: string;
	includeDebug: boolean;
	includeLicenseKey: boolean;
	fullDetail: boolean;
	screenshots: AttachedScreenshot[];
	/** A rejected attachment survives minimize, so the user still learns why it isn't there. */
	attachError: string | null;
}

function dataUrlOf(shot: ScreenshotAttachment): string {
	return `data:${shot.mimeType};base64,${shot.dataBase64}`;
}

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
	initialState,
	onMinimize,
	onCapture,
	onClose,
}: FeedbackModalProps) {
	const { cls, tid } = useScopedStyles("feedback", buildFeedbackStyles);
	const [type, setType] = useState<FeedbackType>(initialState?.type ?? "bug");
	const [text, setText] = useState(initialState?.text ?? "");
	const [includeDebug, setIncludeDebug] = useState(initialState?.includeDebug ?? true);
	const [includeLicenseKey, setIncludeLicenseKey] = useState(
		initialState?.includeLicenseKey ?? licenseAttributionAvailable
	);
	const [fullDetail, setFullDetail] = useState(initialState?.fullDetail ?? false);
	const [screenshots, setScreenshots] = useState<AttachedScreenshot[]>(initialState?.screenshots ?? []);
	const [preview, setPreview] = useState<AttachedScreenshot | null>(null);
	const [phase, setPhase] = useState<Phase>("form");
	const [error, setError] = useState<string | null>(null);
	const [attachError, setAttachError] = useState<string | null>(initialState?.attachError ?? null);
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
		// Removing the image being previewed would leave the lightbox showing
		// something that is no longer attached.
		setPreview((current) => (current?.id === id ? null : current));
		setAttachError(null);
	}, []);

	const closePreview = useCallback(() => setPreview(null), []);

	const snapshot = useCallback(
		(): FeedbackFormState => ({ type, text, includeDebug, includeLicenseKey, fullDetail, screenshots, attachError }),
		[attachError, fullDetail, includeDebug, includeLicenseKey, screenshots, text, type]
	);

	const minimize = useCallback(() => onMinimize?.(snapshot()), [onMinimize, snapshot]);
	const startCapture = useCallback(() => onCapture?.(snapshot()), [onCapture, snapshot]);

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
					<div className={cls("thanks-title")}>Sent — thank you</div>
					<div className={cls("thanks-body")}>
						{`This is read by the person who builds ${pluginDisplayName}, and it shapes what gets worked on next. There is no reply to this form, so if you need an answer, ask on GitHub.`}
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
			{(onMinimize !== undefined || onCapture !== undefined) && (
				<div className={cls("window-actions")} data-testid={tid("window-actions")}>
					{onCapture !== undefined && (
						<button
							type="button"
							className={cls("window-action")}
							aria-label="Take a screenshot"
							title="Minimize and take a screenshot of Obsidian"
							onClick={startCapture}
							data-testid={tid("screenshot")}
						>
							📷
						</button>
					)}
					{onMinimize !== undefined && (
						<button
							type="button"
							className={cls("window-action")}
							aria-label="Minimize"
							title="Minimize — the report keeps everything you have written"
							onClick={minimize}
							data-testid={tid("minimize")}
						>
							⤓
						</button>
					)}
				</div>
			)}

			<p className={cls("intro")} data-testid={tid("intro")}>
				{TYPE_INTROS[type]}
			</p>

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
				// The description is the only thing the user must supply — after a
				// capture round-trip especially, they should be able to just type.
				autoFocus
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
					<span>
						Include debug info — recent warnings, errors and the last few minutes of activity. This is what makes a bug
						report actionable.
					</span>
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
					<summary className={cls("disclosure")}>Review exactly what will be attached</summary>
					<pre className={cls("bundle-preview")} data-testid={tid("bundle-preview")}>
						{serializeForExport(bundle, { fullDetail })}
					</pre>
				</details>
			)}

			{screenshots.length > 0 && (
				<div className={cls("attachments")} data-testid={tid("attachments")}>
					{screenshots.map((shot, index) => (
						<div key={shot.id} className={cls("thumb")} data-testid={tid(`thumb-${index}`)}>
							<button
								type="button"
								className={cls("thumb-open")}
								aria-label={`Preview ${shot.name}`}
								onClick={() => setPreview(shot)}
								data-testid={tid(`thumb-open-${index}`)}
							>
								<img src={dataUrlOf(shot)} alt={shot.name} />
							</button>
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
				<span
					className={cls("attach-hint")}
				>{`or paste an image from your clipboard — up to ${FEEDBACK_MAX_SCREENSHOTS}`}</span>
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

			{preview !== null && <ImageLightbox src={dataUrlOf(preview)} label={preview.name} onClose={closePreview} />}

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
	initialState?: Partial<FeedbackFormState> | undefined;
	onMinimize?: ((state: FeedbackFormState) => void) | undefined;
	onCapture?: ((state: FeedbackFormState) => void) | undefined;
}

/** Lets the host close the report from outside — which is what minimizing is. */
export interface FeedbackModalHandle {
	close: () => void;
}

export function showFeedbackReactModal(app: App, config: ShowFeedbackModalConfig): FeedbackModalHandle {
	let close = (): void => {};
	showReactModal({
		app,
		cls: `${config.cssPrefix}feedback-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: "Send feedback",
		render: (closeModal) => {
			close = closeModal;
			return (
				<FeedbackModalContent
					pluginDisplayName={config.pluginDisplayName}
					privacyUrl={config.privacyUrl}
					captureDebugBundle={config.captureDebugBundle}
					licenseAttributionAvailable={config.licenseAttributionAvailable}
					submit={config.submit}
					initialState={config.initialState}
					onMinimize={config.onMinimize}
					onCapture={config.onCapture}
					onClose={closeModal}
				/>
			);
		},
	});
	return { close: () => close() };
}
