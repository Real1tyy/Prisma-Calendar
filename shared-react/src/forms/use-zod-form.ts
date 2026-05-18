import { useForm, type DefaultValues, type FieldValues, type UseFormProps, type UseFormReturn } from "react-hook-form";
import type { z, ZodType } from "zod";

import { zodV4Resolver } from "./zod-resolver";

export interface UseZodFormOptions<TValues extends FieldValues, TSchema extends ZodType> extends Omit<
	UseFormProps<TValues>,
	"resolver"
> {
	schema: TSchema;
	defaultValues?: DefaultValues<TValues>;
}

export function useZodForm<TSchema extends ZodType<FieldValues>>(
	options: UseZodFormOptions<z.infer<TSchema>, TSchema>
): UseFormReturn<z.infer<TSchema>> {
	const { schema, defaultValues, ...rest } = options;
	const resolvedDefaults = defaultValues ?? (schema.parse({}) as DefaultValues<z.infer<TSchema>>);
	return useForm<z.infer<TSchema>>({
		...rest,
		defaultValues: resolvedDefaults,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolver: zodV4Resolver(schema) as any,
	});
}
