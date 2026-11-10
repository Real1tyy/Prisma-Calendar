/**
 * Compile-time proofs for the submission wire contract. Nothing here runs: `tsc`
 * checks this file with the rest of `src/`, and each `@ts-expect-error` fails the
 * typecheck if its line ever stops being an error
 * ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).
 */
import type { PluginFeedbackRequest, ReviewRequest } from "../../billing-api/generated/model";
import {
	SUBMISSION_PAYLOAD_FIELDS,
	type PayloadFieldsAgainst,
	type SubmissionPayloadFields,
} from "./submission-client";

/** The pinned spec accepts every field the client sends. */
export const shippedListsCompile = SUBMISSION_PAYLOAD_FIELDS satisfies SubmissionPayloadFields;

/** A key the server's review body doesn't declare can't be allow-listed. */
export const extraReviewKey = {
	// @ts-expect-error -- `locale` is not on the published review body.
	review: ["rating", "locale"],
	feedback: ["type", "text"],
} as const satisfies SubmissionPayloadFields;

/** A misspelled feedback key is caught the same way. */
export const misspelledFeedbackKey = {
	review: ["rating"],
	// @ts-expect-error -- `screenshot` is not `screenshots`.
	feedback: ["type", "screenshot"],
} as const satisfies SubmissionPayloadFields;

/**
 * The `health` drift, replayed: pinned to a spec from before the server accepted
 * `health`, the real allow-list stops compiling.
 */
interface BodiesBeforeTheHealthFix {
	review: ReviewRequest;
	feedback: Omit<PluginFeedbackRequest, "health">;
}

function fieldsAgainst<Bodies extends BodiesBeforeTheHealthFix>(fields: PayloadFieldsAgainst<Bodies>): void {
	void fields;
}

// @ts-expect-error -- the shipped list names `health`, which that spec lacks.
fieldsAgainst<BodiesBeforeTheHealthFix>(SUBMISSION_PAYLOAD_FIELDS);
