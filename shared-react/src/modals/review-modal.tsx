import type { ReviewSubmission, StarRating, SubmissionResult } from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";
import { memo, useCallback, useRef, useState, type KeyboardEvent } from "react";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { showReactModal } from "../show-react-modal";
import { cx } from "../utils/cx";
import { buildReviewStyles } from "./review-modal.styles";

const RATINGS: readonly StarRating[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/**
 * `form` collects the rating, `sending` is in flight, `sent` is terminal. The
 * terminal state is what enforces one submission per modal session (R5): the
 * form is gone, so there is nothing left to double-submit.
 */
type Phase = "form" | "sending" | "sent";

export interface ReviewModalProps {
	/** Short plugin name woven into the prompt, e.g. `"Prisma Calendar"`. */
	pluginDisplayName: string;
	/** Whether this verified Pro install can attach its license key. */
	licenseAttributionAvailable?: boolean | undefined;
	/** Posts the rating. Returns a typed result — it never throws. */
	submit: (submission: ReviewSubmission, includeLicenseKey: boolean) => Promise<SubmissionResult>;
	onClose: () => void;
}

function starLabel(value: StarRating): string {
	return value === 1 ? "1 star" : `${value} stars`;
}

/** Arrow/Home/End navigation inside the star radiogroup. `null` = key not ours. */
function nextStar(key: string, current: StarRating): StarRating | null {
	const clamp = (value: number): StarRating => Math.min(5, Math.max(0.5, value)) as StarRating;
	switch (key) {
		case "ArrowRight":
		case "ArrowUp":
			return clamp(current + 0.5);
		case "ArrowLeft":
		case "ArrowDown":
			return clamp(current - 0.5);
		case "Home":
			return 0.5;
		case "End":
			return 5;
		default:
			return null;
	}
}

export const ReviewModalContent = memo(function ReviewModalContent({
	pluginDisplayName,
	licenseAttributionAvailable = false,
	submit,
	onClose,
}: ReviewModalProps) {
	const { cls, tid } = useScopedStyles("review", buildReviewStyles);
	const [rating, setRating] = useState<StarRating | null>(null);
	const [text, setText] = useState("");
	const [includeLicenseKey, setIncludeLicenseKey] = useState(licenseAttributionAvailable);
	const [phase, setPhase] = useState<Phase>("form");
	const [error, setError] = useState<string | null>(null);
	const starRefs = useRef<(HTMLButtonElement | null)[]>([]);
	// Guards a second click landing in the same tick as the first, before the
	// `sending` phase has re-rendered the disabled button.
	const inFlightRef = useRef(false);

	const chooseStar = useCallback((value: StarRating) => {
		setRating(value);
		starRefs.current[RATINGS.indexOf(value)]?.focus();
	}, []);

	const handleStarKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>, value: StarRating) => {
			const target = nextStar(event.key, value);
			if (target === null || target === value) return;
			event.preventDefault();
			chooseStar(target);
		},
		[chooseStar]
	);

	const handleSubmit = useCallback(async () => {
		if (rating === null || inFlightRef.current) return;
		inFlightRef.current = true;
		setPhase("sending");
		setError(null);

		const submission: ReviewSubmission = { rating, ...(text.trim() ? { text: text.trim() } : {}) };
		const result = await submit(submission, licenseAttributionAvailable && includeLicenseKey);

		inFlightRef.current = false;
		if (result.ok) {
			setPhase("sent");
			return;
		}
		// The typed text stays in state on purpose — a failed send must cost the
		// user nothing, so "Try again" resubmits exactly what they wrote.
		setPhase("form");
		setError(result.message);
	}, [includeLicenseKey, licenseAttributionAvailable, rating, text, submit]);

	if (phase === "sent") {
		return (
			<div data-testid={tid("modal")}>
				<div className={cls("thanks")} data-testid={tid("thanks")}>
					<div className={cls("thanks-title")}>Thank you!</div>
					<div className={cls("thanks-body")}>
						{`Your rating is on its way. It genuinely helps ${pluginDisplayName} get better.`}
					</div>
					<Button variant="primary" onClick={onClose} testId={tid("close")}>
						Close
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div data-testid={tid("modal")}>
			<p className={cls("intro")}>How would you rate your experience so far? A rating is enough — words optional.</p>

			<div role="radiogroup" aria-label="Star rating" className={cls("stars")} data-testid={tid("stars")}>
				{RATINGS.map((value, index) => {
					return (
						<button
							key={value}
							ref={(el) => {
								starRefs.current[index] = el;
							}}
							type="button"
							role="radio"
							aria-checked={rating === value}
							aria-label={starLabel(value)}
							// Roving tabindex: one stop for the group, landing on the
							// current choice (or half a star before anything is chosen).
							tabIndex={rating === null ? (value === 0.5 ? 0 : -1) : rating === value ? 0 : -1}
							className={cx(
								cls("star-half"),
								Number.isInteger(value) ? cls("star-right") : cls("star-left"),
								rating !== null && value <= rating && cls("star-filled")
							)}
							onClick={() => chooseStar(value)}
							onKeyDown={(event) => handleStarKeyDown(event, value)}
							data-testid={tid(`star-${value}`)}
						>
							<span aria-hidden="true">★</span>
						</button>
					);
				})}
			</div>

			<textarea
				className={cls("text")}
				aria-label="Your review"
				placeholder="What works well, what could be better? (optional)"
				value={text}
				onChange={(event) => setText(event.target.value)}
				data-testid={tid("text")}
			/>

			{licenseAttributionAvailable && (
				<label className={cls("license-option")}>
					<input
						type="checkbox"
						checked={includeLicenseKey}
						onChange={(event) => setIncludeLicenseKey(event.target.checked)}
						data-testid={tid("include-license")}
					/>
					<span>Include my license key so this review can be linked to my Pro account</span>
				</label>
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
					disabled={rating === null || phase === "sending"}
					onClick={() => void handleSubmit()}
					testId={tid("submit")}
				>
					{phase === "sending" ? "Sending…" : error !== null ? "Try again" : "Submit"}
				</Button>
			</div>
		</div>
	);
});

export interface ShowReviewModalConfig {
	/** Trailing-dash CSS prefix, e.g. `"prisma-"` — drives the modal class + styles. */
	cssPrefix: string;
	pluginDisplayName: string;
	licenseAttributionAvailable?: boolean | undefined;
	submit: (submission: ReviewSubmission, includeLicenseKey: boolean) => Promise<SubmissionResult>;
}

export function showReviewReactModal(app: App, config: ShowReviewModalConfig): void {
	showReactModal({
		app,
		cls: `${config.cssPrefix}review-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: `Enjoying ${config.pluginDisplayName}?`,
		render: (close) => (
			<ReviewModalContent
				pluginDisplayName={config.pluginDisplayName}
				licenseAttributionAvailable={config.licenseAttributionAvailable}
				submit={config.submit}
				onClose={close}
			/>
		),
	});
}
