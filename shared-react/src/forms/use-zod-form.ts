import type { DefaultValues, FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z, ZodType } from "zod";

import { zodV4Resolver } from "./zod-resolver";

export interface UseZodFormOptions<TValues extends FieldValues, TSchema extends ZodType>
	extends Omit<UseFormProps<TValues>, "resolver"> {
	schema: TSchema;
	defaultValues?: DefaultValues<TValues>;
}

export function useZodForm<TSchema extends ZodType<FieldValues>>(
	options: UseZodFormOptions<z.infer<TSchema>, TSchema>
): UseFormReturn<z.infer<TSchema>> {
	const { schema, ...rest } = options;
	return useForm<z.infer<TSchema>>({
		...rest,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolver: zodV4Resolver(schema) as any,
	});
}
