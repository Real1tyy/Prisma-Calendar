import { extractContentAfterFrontmatter } from "@real1ty/obsidian-plugins";
import { TextareaInput } from "@real1ty/obsidian-plugins-react";
import { TFile, type App } from "obsidian";
import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
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
	const markContentDirty = () => {
		dirtyRef.current = true;
		onContentDirty();
	};

	// Dirty is a latch for the modal's lifetime (the parent only ever sets it to
	// true): once the user has typed, an external write must never replace the
	// draft, so the ref is never lowered back to false.
	useLayoutEffect(() => {
		if (contentDirty) dirtyRef.current = true;
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
		<div
			ref={containerRef}
			className="prisma-note-content-section"
			data-testid="prisma-event-field-content"
			// Latch the ref on the keystroke itself: the committed change is
			// debounced, and an external write arriving before it commits would
			// otherwise still see a clean field and replace the draft. Only the ref
			// is touched here — notifying the parent would re-render mid-edit and
			// resync the textarea's draft back to the not-yet-committed value.
			onInputCapture={() => {
				dirtyRef.current = true;
			}}
		>
			<h3 className="prisma-note-content-heading" data-testid="prisma-event-field-content-label">
				Note content
			</h3>
			<TextareaInput
				value={field.value}
				onChange={(content) => {
					markContentDirty();
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
