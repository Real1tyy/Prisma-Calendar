import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

interface SchemaArrayFieldProps<TValues extends FieldValues> {
	form: UseFormReturn<TValues>;
	name: string;
	itemType: "string" | "number";
}

export function SchemaArrayField<TValues extends FieldValues>({
	form,
	name,
	itemType,
}: SchemaArrayFieldProps<TValues>) {
	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: name as never,
	});

	return (
		<div className="schema-form-array">
			{fields.map((field, index) => (
				<div key={field.id} className="schema-form-array-row">
					<input
						type={itemType === "number" ? "number" : "text"}
						className="setting-input"
						{...form.register(`${name}.${index}.value` as never, {
							valueAsNumber: itemType === "number",
						})}
					/>
					<button type="button" className="clickable-icon" aria-label="Remove item" onClick={() => remove(index)}>
						×
					</button>
				</div>
			))}
			<button
				type="button"
				className="clickable-icon schema-form-array-add"
				onClick={() => append((itemType === "number" ? { value: 0 } : { value: "" }) as never)}
			>
				+ Add item
			</button>
		</div>
	);
}
