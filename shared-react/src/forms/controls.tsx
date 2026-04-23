import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useController } from "react-hook-form";

import { Dropdown } from "../components/setting-controls";
import { NumberInput } from "../components/setting-controls";
import { TextInput } from "../components/setting-controls";
import { Toggle } from "../components/setting-controls";

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
	return <Toggle value={!!field.value} onChange={field.onChange} {...(testId ? { testId } : {})} />;
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
			{...(testId ? { testId } : {})}
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
			{...(testId ? { testId } : {})}
		/>
	);
}

export function FormDropdown<TValues extends FieldValues, TName extends FieldPath<TValues>>({
	form,
	name,
	options,
	testId,
}: FormFieldBase<TValues, TName> & { options: Record<string, string> }) {
	const { field } = useController({ control: form.control, name });
	return (
		<Dropdown
			value={String(field.value ?? "")}
			options={options}
			onChange={field.onChange}
			{...(testId ? { testId } : {})}
		/>
	);
}
