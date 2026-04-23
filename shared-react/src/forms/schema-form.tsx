import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { camelCaseToLabel, introspectShape } from "@real1ty-obsidian-plugins";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useFormState } from "react-hook-form";
import type { ZodObject, ZodRawShape } from "zod";

import { SettingHeading, SettingItem } from "../components/setting-item";
import { FormDropdown, FormNumberInput, FormTextInput, FormToggle } from "./controls";
import { SchemaArrayField } from "./schema-array-field";

export interface SchemaFormFieldOverride {
	label?: string;
	description?: string;
	placeholder?: string;
	options?: Record<string, string>;
	min?: number;
	max?: number;
	step?: number;
	hidden?: boolean;
	render?: (props: { form: UseFormReturn<FieldValues>; name: string; descriptor: SchemaFieldDescriptor }) => ReactNode;
}

export interface SchemaFormSection {
	heading?: string;
	fields: string[];
}

export interface SchemaFormProps<TValues extends FieldValues = FieldValues> {
	form: UseFormReturn<TValues>;
	schema: ZodObject<ZodRawShape>;
	fieldOverrides?: Record<string, SchemaFormFieldOverride>;
	sections?: SchemaFormSection[];
	testIdPrefix?: string;
}

function FieldError({ message }: { message: string | undefined }) {
	if (!message) return null;
	return <span className="setting-item-error">{message}</span>;
}

function FormFieldRow<TValues extends FieldValues>({
	descriptor,
	form,
	override,
	testIdPrefix,
}: {
	descriptor: SchemaFieldDescriptor;
	form: UseFormReturn<TValues>;
	override?: SchemaFormFieldOverride | undefined;
	testIdPrefix?: string | undefined;
}) {
	const { errors } = useFormState({ control: form.control, name: descriptor.key as never });

	if (override?.hidden) return null;

	const label = override?.label ?? descriptor.label;
	const description = override?.description ?? descriptor.description;
	const name = descriptor.key as never;
	const error = errors[descriptor.key];
	const errorMessage = typeof error?.message === "string" ? error.message : undefined;
	const testId = testIdPrefix ? `${testIdPrefix}field-${descriptor.key}` : undefined;
	const controlTestId = testIdPrefix ? `${testIdPrefix}control-${descriptor.key}` : undefined;

	if (override?.render) {
		return (
			<SettingItem name={label} description={description} testId={testId}>
				{override.render({ form: form as UseFormReturn<FieldValues>, name: descriptor.key, descriptor })}
				<FieldError message={errorMessage} />
			</SettingItem>
		);
	}

	let control: ReactNode;

	if (override?.options) {
		control = <FormDropdown form={form} name={name} options={override.options} testId={controlTestId} />;
	} else
		switch (descriptor.type) {
			case "boolean":
			case "toggle":
				control = <FormToggle form={form} name={name} testId={controlTestId} />;
				break;
			case "number":
				control = (
					<FormNumberInput
						form={form}
						name={name}
						min={override?.min ?? descriptor.min}
						max={override?.max ?? descriptor.max}
						step={override?.step}
						testId={controlTestId}
					/>
				);
				break;
			case "enum":
				control = (
					<FormDropdown
						form={form}
						name={name}
						options={Object.fromEntries(
							descriptor.enumValues.map((v) => [v, descriptor.enumLabels?.[v] ?? camelCaseToLabel(v)])
						)}
						testId={controlTestId}
					/>
				);
				break;
			case "array":
				control = <SchemaArrayField form={form} name={descriptor.key} itemType={descriptor.itemType} />;
				break;
			default:
				control = (
					<FormTextInput
						form={form}
						name={name}
						placeholder={override?.placeholder ?? descriptor.placeholder}
						testId={controlTestId}
					/>
				);
				break;
		}

	return (
		<SettingItem
			name={label}
			description={
				<>
					{description}
					<FieldError message={errorMessage} />
				</>
			}
			testId={testId}
		>
			{control}
		</SettingItem>
	);
}

function renderFields<TValues extends FieldValues>(
	descriptors: SchemaFieldDescriptor[],
	keys: string[],
	form: UseFormReturn<TValues>,
	overrides?: Record<string, SchemaFormFieldOverride>,
	testIdPrefix?: string
): ReactNode[] {
	const byKey = new Map(descriptors.map((d) => [d.key, d]));
	return keys
		.map((key) => {
			const descriptor = byKey.get(key);
			if (!descriptor) return null;
			const fieldOverride = overrides?.[key];
			return (
				<FormFieldRow
					key={key}
					descriptor={descriptor}
					form={form}
					{...(fieldOverride ? { override: fieldOverride } : {})}
					{...(testIdPrefix ? { testIdPrefix } : {})}
				/>
			);
		})
		.filter(Boolean);
}

export function SchemaForm<TValues extends FieldValues>({
	form,
	schema,
	fieldOverrides,
	sections,
	testIdPrefix,
}: SchemaFormProps<TValues>) {
	const descriptors = useMemo(() => introspectShape(schema.shape as ZodRawShape), [schema]);

	if (sections) {
		return (
			<>
				{sections.map((section, i) => (
					<div key={section.heading ?? i}>
						{section.heading && <SettingHeading name={section.heading} />}
						{renderFields(descriptors, section.fields, form, fieldOverrides, testIdPrefix)}
					</div>
				))}
			</>
		);
	}

	const allKeys = descriptors.map((d) => d.key);
	return <>{renderFields(descriptors, allKeys, form, fieldOverrides, testIdPrefix)}</>;
}
