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
		if (!(path in errors)) {
			errors[path] = { message: issue.message, type: issue.code };
		}
	}
	return errors;
}

function toNestedErrors(flatErrors: Record<string, FieldError>): FieldErrors {
	const result: FieldErrors = {};
	for (const [path, error] of Object.entries(flatErrors)) {
		const parts = path.split(".");
		let current = result as Record<string, unknown>;
		for (let i = 0; i < parts.length - 1; i++) {
			if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
				current[parts[i]] = {};
			}
			current = current[parts[i]] as Record<string, unknown>;
		}
		(current as Record<string, FieldError>)[parts[parts.length - 1]] = error;
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
	return (values: TValues) => {
		const result = schema.safeParse(values);
		if (result.success) {
			return Promise.resolve({ values: result.data as TValues, errors: {} });
		}
		const zodError = result.error as unknown as { issues: ZodIssue[] };
		return Promise.resolve({ values: {} as TValues, errors: toNestedErrors(parseZodIssues(zodError.issues)) });
	};
}
