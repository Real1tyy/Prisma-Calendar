import type { FieldError, FieldErrors, FieldValues, ResolverOptions } from "react-hook-form";
import type { ZodType } from "zod";

interface ZodIssue {
	path: (string | number)[];
	message: string;
	code: string;
}

function parseZodIssues(issues: ZodIssue[]): Record<string, FieldError> {
	const errors: Record<string, FieldError> = {};
	for (const issue of issues) {
		const path = issue.path.join(".");
		if (!errors[path]) {
			errors[path] = { message: issue.message, type: issue.code };
		}
	}
	return errors;
}

function toNestedErrors(flatErrors: Record<string, FieldError>): FieldErrors {
	const result: FieldErrors = {};
	for (const [path, error] of Object.entries(flatErrors)) {
		const parts = path.split(".");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let current: any = result;
		for (let i = 0; i < parts.length - 1; i++) {
			if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
				current[parts[i]] = {};
			}
			current = current[parts[i]];
		}
		current[parts[parts.length - 1]] = error;
	}
	return result;
}

export function zodV4Resolver<TValues extends FieldValues>(
	schema: ZodType
): (
	values: TValues,
	context: unknown,
	options: ResolverOptions<TValues>
) => Promise<{ values: TValues; errors: FieldErrors }> {
	return async (values: TValues) => {
		const result = schema.safeParse(values);
		if (result.success) {
			return { values: result.data as TValues, errors: {} as FieldErrors };
		}
		const zodError = result.error as unknown as { issues: ZodIssue[] };
		return { values: {} as TValues, errors: toNestedErrors(parseZodIssues(zodError.issues)) };
	};
}
