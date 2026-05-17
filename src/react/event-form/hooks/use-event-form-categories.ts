import { isObsidianLink } from "@real1ty-obsidian-plugins";
import { useCallback, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import { showCategoryEventsModal } from "../../../components/modals/series/bases-view";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { SingleCalendarConfig } from "../../../types/settings";
import { autoAssignCategories } from "../../../utils/events/matching";
import { extractCleanDisplayName } from "../../../utils/events/naming";
import { openCategoryAssignModal, openPrerequisiteAssignModal } from "../../modals";

export interface UseEventFormCategoriesOptions {
	bundle: CalendarBundle;
	settings: SingleCalendarConfig;
	form: UseFormReturn<EventFormState>;
	suppressAutoCategories: boolean;
	setSuppressAutoCategories: (value: boolean) => void;
}

export interface UseEventFormCategoriesResult {
	categories: string[];
	participants: string[];
	prerequisites: string[];
	categoryColors: Map<string, string>;
	getDisplayName: (link: string) => string;
	getPrerequisiteDisplayName: (link: string) => string;
	onCategoriesChange: (cats: string[]) => void;
	onAssignCategories: () => void;
	onAssignPrerequisites: () => void;
	onCategoryClick: (name: string) => void;
	onParticipantsChange: (values: string[]) => void;
	onPrerequisitesChange: (values: string[]) => void;
	applyAutoCategories: () => void;
	onTitleBlur: () => void;
}

/**
 * Owns the three chip-list fields (categories, participants, prerequisites):
 * the live values, the color lookup, the assign-modal openers, and the
 * title-blur auto-assignment. The parent passes `suppressAutoCategories`
 * because the same flag also gates `handlePresetChange`.
 */
export function useEventFormCategories({
	bundle,
	settings,
	form,
	suppressAutoCategories,
	setSuppressAutoCategories,
}: UseEventFormCategoriesOptions): UseEventFormCategoriesResult {
	const categories = useWatch({ control: form.control, name: "categories" });
	const participants = useWatch({ control: form.control, name: "participants" });
	const prerequisites = useWatch({ control: form.control, name: "prerequisites" });

	const categoryColors = useMemo(() => {
		return new Map(bundle.categoryTracker.getCategoriesWithColors().map((c) => [c.name, c.color]));
	}, [bundle]);

	const defaultColor = settings.defaultNodeColor;

	const getDisplayName = useCallback((link: string) => {
		return isObsidianLink(link) ? extractCleanDisplayName(link) : link;
	}, []);

	const getPrerequisiteDisplayName = useCallback((link: string) => {
		return extractCleanDisplayName(link);
	}, []);

	const onCategoriesChange = useCallback(
		(cats: string[]) => {
			form.setValue("categories", cats);
			setSuppressAutoCategories(true);
		},
		[form, setSuppressAutoCategories]
	);

	const onAssignCategories = useCallback(() => {
		setSuppressAutoCategories(true);
		const categoriesWithColors = bundle.categoryTracker.getCategoriesWithColors();
		void openCategoryAssignModal(
			bundle.plugin.app,
			categoriesWithColors,
			defaultColor,
			form.getValues("categories")
		).then((selected) => {
			if (selected) form.setValue("categories", selected);
		});
	}, [bundle, defaultColor, form, setSuppressAutoCategories]);

	const onAssignPrerequisites = useCallback(() => {
		void openPrerequisiteAssignModal(bundle.plugin.app, bundle, form.getValues("prerequisites")).then((selected) => {
			if (selected) form.setValue("prerequisites", selected);
		});
	}, [bundle, form]);

	const onCategoryClick = useCallback(
		(name: string) => {
			showCategoryEventsModal(bundle.plugin.app, name, settings);
		},
		[bundle, settings]
	);

	const onParticipantsChange = useCallback(
		(values: string[]) => {
			form.setValue("participants", values);
		},
		[form]
	);

	const onPrerequisitesChange = useCallback(
		(values: string[]) => {
			form.setValue("prerequisites", values);
		},
		[form]
	);

	const applyAutoCategories = useCallback(() => {
		if (suppressAutoCategories) return;
		const title = form.getValues("title").trim();
		if (!title) return;

		const hasAutoAssign = settings.autoAssignCategoryByName || settings.categoryAssignmentPresets.length > 0;
		if (!hasAutoAssign) return;

		const availableCategories = bundle.categoryTracker.getCategories();
		const assigned = autoAssignCategories(title, settings, availableCategories, bundle.plugin.isProEnabled);
		if (assigned.length > 0) {
			form.setValue("categories", assigned);
		}
	}, [suppressAutoCategories, form, settings, bundle]);

	const onTitleBlur = useCallback(() => {
		applyAutoCategories();
	}, [applyAutoCategories]);

	return {
		categories,
		participants,
		prerequisites,
		categoryColors,
		getDisplayName,
		getPrerequisiteDisplayName,
		onCategoriesChange,
		onAssignCategories,
		onAssignPrerequisites,
		onCategoryClick,
		onParticipantsChange,
		onPrerequisitesChange,
		applyAutoCategories,
		onTitleBlur,
	};
}
