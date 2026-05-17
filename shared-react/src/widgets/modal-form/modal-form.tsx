import type { ReactNode } from "react";
import { useCallback } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

interface ModalFormBaseProps {
	children: ReactNode;
	onCancel: () => void;
	submitLabel?: string | undefined;
	cancelLabel?: string | undefined;
	submitDisabled?: boolean | undefined;
	submitTestId?: string | undefined;
	cancelTestId?: string | undefined;
	destructive?: boolean | undefined;
}

export interface ModalFormProps extends ModalFormBaseProps {
	onSubmit: () => void;
}

export interface ModalSchemaFormProps<T extends FieldValues> extends ModalFormBaseProps {
	form: UseFormReturn<T>;
	onSubmit: (values: T) => void;
}

function ModalFormButtons({
	onCancel,
	submitLabel = "Save",
	cancelLabel = "Cancel",
	submitDisabled,
	submitTestId = "prisma-form-submit",
	cancelTestId = "prisma-form-cancel",
	destructive,
}: Omit<ModalFormBaseProps, "children">) {
	return (
		<div className="modal-button-container">
			<button type="button" className="mod-cancel" onClick={onCancel} data-testid={cancelTestId}>
				{cancelLabel}
			</button>
			<button
				type="submit"
				className={destructive ? "mod-warning" : "mod-cta"}
				disabled={submitDisabled}
				data-testid={submitTestId}
			>
				{submitLabel}
			</button>
		</div>
	);
}

export function ModalForm({
	children,
	onSubmit,
	onCancel,
	submitLabel,
	cancelLabel,
	submitDisabled,
	submitTestId,
	cancelTestId,
	destructive,
}: ModalFormProps) {
	const handleSubmit = useCallback(
		(e: React.BaseSyntheticEvent) => {
			e.preventDefault();
			if (!submitDisabled) onSubmit();
		},
		[onSubmit, submitDisabled]
	);

	return (
		<form onSubmit={handleSubmit}>
			{children}
			<ModalFormButtons
				onCancel={onCancel}
				submitLabel={submitLabel}
				cancelLabel={cancelLabel}
				submitDisabled={submitDisabled}
				submitTestId={submitTestId}
				cancelTestId={cancelTestId}
				destructive={destructive}
			/>
		</form>
	);
}

export function ModalSchemaForm<T extends FieldValues>({
	children,
	form,
	onSubmit,
	onCancel,
	submitLabel,
	cancelLabel,
	submitDisabled,
	submitTestId,
	cancelTestId,
	destructive,
}: ModalSchemaFormProps<T>) {
	const handleSubmit = useCallback(
		(e: React.BaseSyntheticEvent) => {
			e.preventDefault();
			void form.handleSubmit(onSubmit)(e);
		},
		[form, onSubmit]
	);

	return (
		<form onSubmit={handleSubmit}>
			{children}
			<ModalFormButtons
				onCancel={onCancel}
				submitLabel={submitLabel}
				cancelLabel={cancelLabel}
				submitDisabled={submitDisabled}
				submitTestId={submitTestId}
				cancelTestId={cancelTestId}
				destructive={destructive}
			/>
		</form>
	);
}
