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
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

import { useScoped } from "../contexts/theme-context";
import { useFocusOnMount } from "../hooks/focus";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { ObsidianIcon } from "../primitives/atoms/obsidian-icon";
import { cx } from "../utils/cx";
import { PrivacyDisclaimer } from "../widgets/privacy-disclaimer/privacy-disclaimer";
import { registerActiveFeedbackReport } from "./active-feedback-report";
import { buildFeedbackStyles } from "./feedback-modal.styles";
import { ImageLightbox } from "./image-lightbox";
import type { PreservedFormApi } from "./preserved-form";

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
	/**
	 * The report itself, owned by the preserved-form shell: this component holds
	 * no draft state of its own, which is what makes leaving lossless without it
	 * knowing anything about how it was left ([[knowledge-preserved-form-state]]).
	 */
	form: PreservedFormApi<FeedbackFormState>;
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
				dataBase64: base64Of(typeof reader.result === "string" ? reader.result : ""),
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
	form,
}: FeedbackModalProps) {
	const { cls, tid } = useScopedStyles("feedback", buildFeedbackStyles);
	const { patch, setState, finish, close: onClose } = form;
	const { type, text, includeDebug, includeLicenseKey, fullDetail, screenshots, attachError } = form.state;

	// Named setters over the shell's one state object, so the form reads the same
	// as it would with its own `useState` — the difference is only in who owns it.
	const setText = useCallback((next: string) => patch({ text: next }), [patch]);
	const setIncludeDebug = useCallback((next: boolean) => patch({ includeDebug: next }), [patch]);
	const setIncludeLicenseKey = useCallback((next: boolean) => patch({ includeLicenseKey: next }), [patch]);
	const setFullDetail = useCallback((next: boolean) => patch({ fullDetail: next }), [patch]);
	const setAttachError = useCallback((next: string | null) => patch({ attachError: next }), [patch]);
	const setScreenshots = useCallback(
		(next: AttachedScreenshot[] | ((current: AttachedScreenshot[]) => AttachedScreenshot[])) =>
			setState((current) => ({
				...current,
				screenshots: typeof next === "function" ? next(current.screenshots) : next,
			})),
		[setState]
	);

	// Ephemeral: none of it is worth carrying across a close.
	const [preview, setPreview] = useState<AttachedScreenshot | null>(null);
	const [phase, setPhase] = useState<Phase>("form");
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textRef = useRef<HTMLTextAreaElement | null>(null);

	// Guards a second click landing in the same tick as the first, before the
	// `sending` phase has re-rendered the disabled button.
	const inFlightRef = useRef(false);

	// The description is the only thing the user must supply, so the report opens
	// with the cursor in it. `autoFocus` is not enough: a report re-opened from a
	// command or from the capture bar arrives while Obsidian is still activating
	// the leaf behind it, and that activation takes the focus back a beat later —
	// so this keeps re-claiming it briefly, and stands down the moment the user
	// clicks or types anywhere.
	useFocusOnMount(textRef, { retryMs: 500 });

	// Captured once per toggle rather than at send time, so what the user reviews
	// below the checkbox is byte-for-byte what leaves the device.
	const bundle = useMemo(
		() => (includeDebug && captureDebugBundle !== undefined ? captureDebugBundle() : null),
		[includeDebug, captureDebugBundle]
	);

	const chooseType = useCallback(
		(next: FeedbackType) => {
			// Debug context is what turns "it's broken" into something actionable, so
			// a bug report opts in by default and everything else opts in by hand.
			patch({ type: next, includeDebug: next === "bug" });
		},
		[patch]
	);

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
		[screenshots, setAttachError, setScreenshots]
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
			const files = Array.from(event.clipboardData.files);
			if (files.length === 0) return;
			event.preventDefault();
			void attach(files);
		},
		[attach]
	);

	const removeScreenshot = useCallback(
		(id: string) => {
			setScreenshots((current) => current.filter((shot) => shot.id !== id));
			// Removing the image being previewed would leave the lightbox showing
			// something that is no longer attached.
			setPreview((current) => (current?.id === id ? null : current));
			setAttachError(null);
		},
		[setAttachError, setScreenshots]
	);

	const closePreview = useCallback(() => setPreview(null), []);

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
			// It has been sent — there is nothing left to keep for the user, so the
			// shell must not preserve it on the way out.
			finish();
			setPhase("sent");
			return;
		}
		// Text and attachments stay in state on purpose — a failed send must cost
		// the user nothing, so "Try again" resubmits exactly what they assembled.
		setPhase("form");
		setError(result.message);
	}, [bundle, finish, fullDetail, includeLicenseKey, licenseAttributionAvailable, screenshots, submit, text, type]);

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
				ref={textRef}
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
				{/* Not "Cancel": this keeps the report, exactly like Escape and the X. */}
				<Button onClick={onClose} testId={tid("cancel")}>
					Close
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

/** A pristine report. Also what Clear resets to. */
export function blankFeedbackForm(licenseAttributionAvailable = false): FeedbackFormState {
	return {
		type: "bug",
		text: "",
		includeDebug: true,
		includeLicenseKey: licenseAttributionAvailable,
		fullDetail: false,
		screenshots: [],
		attachError: null,
	};
}

/** A report with nothing in it is nothing to come back to. */
export function isFeedbackFormEmpty(state: FeedbackFormState): boolean {
	return state.text.trim() === "" && state.screenshots.length === 0;
}

export interface FeedbackWindowActionsProps {
	form: PreservedFormApi<FeedbackFormState>;
	/** Puts the report away and starts the screenshot flow. Omitted where capture is unavailable. */
	onCapture: (state: FeedbackFormState) => void;
}

/**
 * The camera, rendered by the shell into the modal's title row beside Clear and
 * the close button. It also registers the report as the one on screen, so a
 * capture command drives *this* form's put-it-away-then-capture path instead of
 * photographing it.
 */
export const FeedbackWindowActions = memo(function FeedbackWindowActions({
	form,
	onCapture,
}: FeedbackWindowActionsProps) {
	// Styled as one of the shell's window controls, named as the feedback form's.
	const { cls } = useScoped("preserved-form");
	const { tid } = useScoped("feedback");
	const { state, finish, close } = form;

	// Closes *this* modal rather than leaving it to a handle the host took when it
	// opened one: a restored report is re-opened by the shell, so any handle the
	// host still holds points at the modal that was already closed — and the
	// report would sit there in the middle of its own screenshot.
	const startCapture = useCallback(() => {
		finish();
		close();
		onCapture(state);
	}, [close, finish, onCapture, state]);

	useEffect(() => registerActiveFeedbackReport({ requestCapture: startCapture }), [startCapture]);

	return (
		<button
			type="button"
			className={cls("window-action")}
			aria-label="Take a screenshot"
			title="Take a screenshot (puts this form away so it stays out of the picture)"
			onClick={startCapture}
			data-testid={tid("screenshot")}
		>
			<ObsidianIcon icon="camera" />
		</button>
	);
});
