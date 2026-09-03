import { extractContentAfterFrontmatter } from "@real1ty/obsidian-plugins";
import { TextareaInput } from "@real1ty/obsidian-plugins-react";
import { TFile, type App } from "obsidian";
import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { useController, type UseFormReturn } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";

interface NoteContentSectionProps {
	app: App;
	form: UseFormReturn<EventFormState>;
	filePath: string | null | undefined;
	contentDirty: boolean;
	onContentDirty: () => void;
	onConflictChange: (conflicted: boolean) => void;
	containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Keeps the note body in sync until the user edits it. Once edited, an external
 * modification is deliberately retained as a conflict rather than overwriting
 * the user's draft.
 */
export const NoteContentSection = memo(function NoteContentSection({
	app,
	form,
	filePath,
	contentDirty,
	onContentDirty,
	onConflictChange,
	containerRef,
}: NoteContentSectionProps) {
	const { field } = useController({ control: form.control, name: "content" });
	const dirtyRef = useRef(contentDirty);
	const loadingRef = useRef(true);
	const [conflicted, setConflicted] = useState(false);

	useEffect(() => {
		dirtyRef.current = contentDirty;
	}, [contentDirty]);

	useEffect(() => {
		if (!filePath || contentDirty) {
			loadingRef.current = false;
			return;
		}
		let cancelled = false;
		const load = async () => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;
			const eventFile = file;
			const content = extractContentAfterFrontmatter(await app.vault.read(eventFile));
			if (!cancelled && !dirtyRef.current) {
				form.setValue("content", content, { shouldDirty: false });
			}
			loadingRef.current = false;
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [app, filePath, form, contentDirty]);

	useEffect(() => {
		if (!filePath) return;
		const ref = app.vault.on("modify", (file) => {
			if (file.path !== filePath || loadingRef.current) return;
			if (!(file instanceof TFile)) return;
			void app.vault.read(file).then((raw) => {
				if (!dirtyRef.current) {
					form.setValue("content", extractContentAfterFrontmatter(raw), { shouldDirty: false });
					setConflicted(false);
					onConflictChange(false);
				} else {
					setConflicted(true);
					onConflictChange(true);
				}
			});
		});
		return () => app.vault.offref(ref);
	}, [app, filePath, form, onConflictChange]);

	return (
		<div ref={containerRef} className="prisma-note-content-section" data-testid="prisma-event-field-content">
			<h3 className="prisma-note-content-heading" data-testid="prisma-event-field-content-label">
				Note content
			</h3>
			<TextareaInput
				value={field.value}
				onChange={(content) => {
					onContentDirty();
					field.onChange(content);
				}}
				rows={8}
				debounceMs={0}
				testId="prisma-event-control-content"
			/>
			{conflicted && (
				<p className="prisma-note-content-conflict" data-testid="prisma-event-field-content-conflict">
					The note changed on disk while you were editing it.
				</p>
			)}
		</div>
	);
});
