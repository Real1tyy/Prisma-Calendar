import { cls, tid } from "@real1ty-obsidian-plugins";
import { ModalForm, openReactModal, SettingItem } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import React, { useCallback, useRef, useState } from "react";

import { type MoveByResult, TIME_UNITS, type TimeUnit } from "../../../types/calendar";

const UNIT_LABELS: Record<TimeUnit, string> = Object.fromEntries(
	TIME_UNITS.map((u) => [u, u.charAt(0).toUpperCase() + u.slice(1)])
) as Record<TimeUnit, string>;

interface MoveByFormProps {
	onSubmit: (result: MoveByResult) => void;
	onCancel: () => void;
}

export function MoveByForm({ onSubmit, onCancel }: MoveByFormProps) {
	const [value, setValue] = useState(15);
	const [unit, setUnit] = useState<TimeUnit>("minutes");
	const inputRef = useRef<HTMLInputElement>(null);

	const adjustValue = useCallback((delta: number) => {
		setValue((prev) => {
			const next = prev + delta;
			if (next === 0) return delta > 0 ? 1 : -1;
			return next;
		});
	}, []);

	const toggleSign = useCallback(() => {
		setValue((prev) => (prev === 0 ? 1 : -prev));
	}, []);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const parsed = Number.parseInt(e.target.value, 10);
		if (!Number.isNaN(parsed)) setValue(parsed);
	}, []);

	const handleSubmit = useCallback(() => {
		onSubmit({ value, unit });
	}, [value, unit, onSubmit]);

	const isInvalid = value === 0 || Number.isNaN(value);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel} submitLabel="Move" submitDisabled={isInvalid}>
			<h3>Move event by</h3>
			<div className={cls("move-by-form")}>
				<SettingItem name="Amount">
					<div className={cls("move-by-amount-group")}>
						<button
							type="button"
							className={cls("move-by-increment-btn")}
							onClick={() => adjustValue(-1)}
							data-testid={tid("move-by-decrement")}
						>
							−
						</button>
						<input
							ref={inputRef}
							type="number"
							value={value}
							step={1}
							className={cls("move-by-input")}
							onChange={handleInputChange}
							data-testid={tid("move-by-value")}
							autoFocus
						/>
						<button
							type="button"
							className={cls("move-by-increment-btn")}
							onClick={() => adjustValue(1)}
							data-testid={tid("move-by-increment")}
						>
							+
						</button>
						<button
							type="button"
							className={cls("move-by-toggle-btn")}
							onClick={toggleSign}
							aria-label="Toggle sign"
							data-testid={tid("move-by-toggle-sign")}
						>
							+/−
						</button>
					</div>
				</SettingItem>

				<SettingItem name="Time unit">
					<div className={cls("move-by-unit-group")}>
						{TIME_UNITS.map((u) => (
							<button
								key={u}
								type="button"
								className={cls("move-by-unit-btn", u === unit ? "is-active" : "")}
								onClick={() => setUnit(u)}
								data-testid={tid("move-by-unit", u)}
							>
								{UNIT_LABELS[u]}
							</button>
						))}
					</div>
				</SettingItem>
			</div>
		</ModalForm>
	);
}

export function openMoveByModal(app: App): Promise<MoveByResult | null> {
	return openReactModal<MoveByResult>({
		app,
		cls: cls("move-by-modal"),
		testId: tid("modal-move-by"),
		render: (submit, cancel) => <MoveByForm onSubmit={submit} onCancel={cancel} />,
	});
}
