import {
	useForm,
	type DefaultValues,
	type FieldValues,
	type Resolver,
	type UseFormProps,
	type UseFormReturn,
} from "react-hook-form";
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
	// schema.parse returns z.infer<TSchema>, which widens to any via FieldValues; the cast narrows it back for the caller's generic
	const resolvedDefaults = defaultValues ?? (schema.parse({}) as DefaultValues<z.infer<TSchema>>);
	return useForm<z.infer<TSchema>>({
		...rest,
		defaultValues: resolvedDefaults,
		resolver: zodV4Resolver(schema) as unknown as Resolver<z.infer<TSchema>>,
	});
}
