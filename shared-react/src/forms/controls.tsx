import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useController } from "react-hook-form";

import { SecretField } from "../primitives/atoms/secret-field";
import { Dropdown } from "../primitives/controls";
import { NumberInput } from "../primitives/controls";
import { TextInput } from "../primitives/controls";
import { Toggle } from "../primitives/controls";
import { testIdProp } from "../utils/test-id";

interface FormFieldBase<TValues extends FieldValues, TName extends FieldPath<TValues>> {
	form: UseFormReturn<TValues>;
	name: TName;
	testId?: string | undefined;
}

export function FormToggle<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	testId,
}: FormFieldBase<TValues, TName>) {
	const { field } = useController({ control: form.control, name });
	return <Toggle value={!!field.value} onChange={field.onChange} {...testIdProp(testId)} />;
}

export function FormTextInput<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	placeholder,
	testId,
}: FormFieldBase<TValues, TName> & { placeholder?: string | undefined }) {
	const { field } = useController({ control: form.control, name });
	return (
		<TextInput
			value={String(field.value ?? "")}
			onChange={field.onChange}
			debounceMs={0}
			{...(placeholder ? { placeholder } : {})}
			{...testIdProp(testId)}
		/>
	);
}

export function FormNumberInput<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	min,
	max,
	step,
	testId,
}: FormFieldBase<TValues, TName> & { min?: number | undefined; max?: number | undefined; step?: number | undefined }) {
	const { field } = useController({ control: form.control, name });
	return (
		<NumberInput
			value={Number(field.value ?? 0)}
			onChange={field.onChange}
			debounceMs={0}
			{...(min !== undefined ? { min } : {})}
			{...(max !== undefined ? { max } : {})}
			{...(step !== undefined ? { step } : {})}
			{...testIdProp(testId)}
		/>
	);
}

export function FormSecretField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	testId,
}: FormFieldBase<TValues, TName>) {
	const { field } = useController({ control: form.control, name });
	return <SecretField value={String(field.value ?? "")} onChange={field.onChange} {...testIdProp(testId)} />;
}

export function FormDropdown<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	options,
	testId,
}: FormFieldBase<TValues, TName> & { options: Record<string, string> }) {
	const { field } = useController({ control: form.control, name });
	return (
		<Dropdown value={String(field.value ?? "")} options={options} onChange={field.onChange} {...testIdProp(testId)} />
	);
}
