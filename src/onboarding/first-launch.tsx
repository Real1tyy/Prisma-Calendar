import { zodResolver } from "@hookform/resolvers/zod";
import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { Button, openReactModal, TextInput, WelcomeModalShell } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, type ReactNode, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { DirectorySuggestion } from "./directory-suggestions";

// ─── Schema ───────────────────────────────────────────────────────────────────

const FormSchema = z.object({
	mode: z.enum(["existing", "new"]),
	directory: z.string().min(1),
	startProp: z.string(),
	endProp: z.string(),
	dateProp: z.string(),
});

type FormValues = z.infer<typeof FormSchema>;

// ─── Types (derived from schema) ─────────────────────────────────────────────

export type FirstLaunchMode = FormValues["mode"];
export type FirstLaunchInitialProps = Pick<FormValues, "startProp" | "endProp" | "dateProp">;
export type FirstLaunchInitialState = Partial<FormValues>;
export type FirstLaunchModalResult = FormValues & { selectedSuggestion: DirectorySuggestion | null };

export interface FirstLaunchControllerProps {
	initialProps: FirstLaunchInitialProps;
	loadSuggestions: () => Promise<DirectorySuggestion[]>;
	initialState?: FirstLaunchInitialState | undefined;
	onSubmit: (result: FirstLaunchModalResult) => void;
}

export type OpenFirstLaunchModalOptions = Omit<FirstLaunchControllerProps, "onSubmit"> & {
	app: App;
};

// ─── Open helper ─────────────────────────────────────────────────────────────

export async function openFirstLaunchModal(
	options: OpenFirstLaunchModalOptions
): Promise<FirstLaunchModalResult | null> {
	return openReactModal<FirstLaunchModalResult>({
		app: options.app,
		cls: "prisma-welcome-modal",
		testId: "prisma-welcome-modal",
		render: (submit) => (
			<FirstLaunchController
				initialProps={options.initialProps}
				loadSuggestions={options.loadSuggestions}
				initialState={options.initialState}
				onSubmit={submit}
			/>
		),
	});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeCard({
	title,
	desc,
	selected,
	testId,
	onSelect,
}: {
	title: string;
	desc: string;
	selected: boolean;
	testId: string;
	onSelect: () => void;
}) {
	return (
		<div
			role="button"
			tabIndex={0}
			className={`prisma-first-launch-mode-card${selected ? " is-selected" : ""}`}
			onClick={onSelect}
			onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
			data-testid={testId}
		>
			<span className="prisma-first-launch-mode-title">{title}</span>
			<span className="prisma-first-launch-mode-desc">{desc}</span>
		</div>
	);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<div className="prisma-first-launch-field">
			<label>{label}</label>
			{hint ? <small>{hint}</small> : null}
			{children}
		</div>
	);
}

// ─── Static content ───────────────────────────────────────────────────────────

const TAGLINE = (
	<>
		<span className="prisma-welcome-tagline-headline">A calendar is just the beginning.</span>
		<span className="prisma-welcome-tagline-sub">
			Prisma turns any note with a date into a flexible planning system inside Obsidian. Start simple now, then dive
			deeper and customize everything later.
		</span>
		<span className="prisma-welcome-tagline-sub">
			I recommend watching this quick tutorial where I explain everything you need to know so you can start using Prisma
			without feeling overwhelmed.
		</span>
	</>
);

const welcomeUtm = (url: string, content: string) =>
	buildUtmUrl(url, "prisma-calendar", "plugin", "welcome_modal", content);

const FOOTER_LINKS = [
	{ label: "Quickstart", href: welcomeUtm("https://www.youtube.com/watch?v=HrcNKh6uFH8", "quickstart_video") },
	{ label: "Features", href: welcomeUtm("https://www.youtube.com/watch?v=HrcNKh6uFH8", "features_video") },
	{ label: "Documentation", href: welcomeUtm("https://real1tyy.github.io/Prisma-Calendar/", "documentation") },
	{ label: "Changelog", href: welcomeUtm("https://real1tyy.github.io/Prisma-Calendar/changelog", "changelog") },
	{
		label: "Product Page",
		href: welcomeUtm("https://matejvavroproductivity.com/tools/prisma-calendar/", "product_page"),
	},
	{ label: "GitHub", href: "https://github.com/Real1tyy/Prisma-Calendar" },
];

// ─── Controller ───────────────────────────────────────────────────────────────

export const FirstLaunchController = memo(function FirstLaunchController({
	initialProps,
	loadSuggestions,
	initialState,
	onSubmit,
}: FirstLaunchControllerProps) {
	const [suggestions, setSuggestions] = useState<DirectorySuggestion[]>([]);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

	const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
		resolver: zodResolver(FormSchema),
		mode: "onChange",
		defaultValues: {
			mode: initialState?.mode ?? "new",
			directory: initialState?.directory ?? "Events",
			startProp: initialState?.startProp ?? initialProps.startProp,
			endProp: initialState?.endProp ?? initialProps.endProp,
			dateProp: initialState?.dateProp ?? initialProps.dateProp,
		},
	});

	const currentMode = watch("mode");
	const currentDirectory = watch("directory");
	const tid = (suffix: string) => `prisma-welcome-${suffix}`;
	const matchedSuggestion = suggestions.find((s) => s.directory === currentDirectory.trim()) ?? null;

	useEffect(() => {
		let cancelled = false;
		void loadSuggestions()
			.then((items) => {
				if (!cancelled) setSuggestions(items);
			})
			.catch(() => {
				if (!cancelled) setSuggestions([]);
			})
			.finally(() => {
				if (!cancelled) setIsLoadingSuggestions(false);
			});
		return () => {
			cancelled = true;
		};
	}, [loadSuggestions]);

	useEffect(() => {
		if (currentMode === "new" && !currentDirectory.trim()) setValue("directory", "Events");
	}, [currentMode, currentDirectory, setValue]);

	const selectSuggestion = (suggestion: DirectorySuggestion): void => {
		setValue("mode", "existing");
		setValue("directory", suggestion.directory);
	};

	const submit = handleSubmit((values) => {
		onSubmit({
			...values,
			directory: values.directory.trim(),
			startProp: values.startProp.trim() || initialProps.startProp,
			endProp: values.endProp.trim() || initialProps.endProp,
			dateProp: values.dateProp.trim() || initialProps.dateProp,
			selectedSuggestion: matchedSuggestion,
		});
	});

	return (
		<WelcomeModalShell
			cssPrefix="prisma"
			title="Welcome to Prisma Calendar"
			tagline={TAGLINE}
			videoEmbedUrl="https://www.youtube.com/embed/HrcNKh6uFH8"
			videoCaption="Start here — this covers everything you need to get going."
			footerLinks={FOOTER_LINKS}
			submitDisabled={!currentDirectory.trim()}
			testIdPrefix="prisma-welcome"
			onSubmit={() => {
				void submit();
			}}
		>
			<section className="prisma-first-launch-mode-grid">
				<ModeCard
					title="Use notes you already have"
					desc="Prisma reads an existing folder and turns your notes into events using your current properties."
					selected={currentMode === "existing"}
					testId={tid("mode-existing")}
					onSelect={() => setValue("mode", "existing")}
				/>
				<ModeCard
					title="Start with a clean setup"
					desc="Prisma creates a new dedicated folder with a simple property schema so you can start planning right away."
					selected={currentMode === "new"}
					testId={tid("mode-new")}
					onSelect={() => setValue("mode", "new")}
				/>
			</section>

			<section className="prisma-first-launch-panel">
				<div className="prisma-first-launch-helper">
					<p>
						Choose the folder Prisma should use for events. Prisma will read those notes and visualize them for you.
					</p>
					<p>
						{currentMode === "existing"
							? "If your property names differ from Prisma defaults, you can configure them below now or change them later at any time."
							: "You can customize the property names below or change them later at any time."}
					</p>
				</div>

				<Field
					label="Event folder"
					hint={
						currentMode === "existing"
							? "Pick one of the detected folders below or type the directory manually."
							: "Prisma will create and read event notes in this directory."
					}
				>
					<Controller
						name="directory"
						control={control}
						render={({ field }) => (
							<TextInput
								value={field.value}
								placeholder={currentMode === "existing" ? "e.g. Calendar, Tasks, Work/Meetings" : "Events"}
								onChange={field.onChange}
								debounceMs={0}
								testId={tid("directory-input")}
							/>
						)}
					/>
				</Field>

				{currentMode === "existing" ? (
					<div className="prisma-first-launch-suggestions">
						{isLoadingSuggestions ? (
							<div className="prisma-first-launch-muted">
								Scanning your vault for folders with date-like frontmatter...
							</div>
						) : suggestions.length === 0 ? (
							<div className="prisma-first-launch-muted">
								No existing folders with date-like frontmatter were detected. You can still type a folder above.
							</div>
						) : (
							suggestions.map((suggestion) => (
								<div
									key={suggestion.directory}
									role="button"
									tabIndex={0}
									className={`prisma-first-launch-suggestion${matchedSuggestion?.directory === suggestion.directory ? " is-selected" : ""}`}
									onClick={() => selectSuggestion(suggestion)}
									onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectSuggestion(suggestion)}
									data-testid={tid(`suggestion-${suggestion.directory.replace(/[^\w-]+/g, "-").toLowerCase()}`)}
								>
									<span className="prisma-first-launch-mode-title">{suggestion.directory}</span>
									<span className="prisma-first-launch-mode-desc">
										{suggestion.fileCount} note{suggestion.fileCount === 1 ? "" : "s"} · Found date-like properties:{" "}
										<strong>{suggestion.matchedProps.join(", ")}</strong>
									</span>
								</div>
							))
						)}
					</div>
				) : null}

				<Field label="Start property" hint="Starting datetime value for timed events.">
					<Controller
						name="startProp"
						control={control}
						render={({ field }) => (
							<TextInput
								value={field.value}
								placeholder={initialProps.startProp}
								onChange={field.onChange}
								debounceMs={0}
								testId={tid("start-prop")}
							/>
						)}
					/>
				</Field>
				<Field label="End property" hint="Ending datetime value for timed events.">
					<Controller
						name="endProp"
						control={control}
						render={({ field }) => (
							<TextInput
								value={field.value}
								placeholder={initialProps.endProp}
								onChange={field.onChange}
								debounceMs={0}
								testId={tid("end-prop")}
							/>
						)}
					/>
				</Field>
				<Field label="Date property" hint="Date value for all-day events.">
					<Controller
						name="dateProp"
						control={control}
						render={({ field }) => (
							<TextInput
								value={field.value}
								placeholder={initialProps.dateProp}
								onChange={field.onChange}
								debounceMs={0}
								testId={tid("date-prop")}
							/>
						)}
					/>
				</Field>
			</section>

			<section className="prisma-first-launch-pro">
				<span className="prisma-first-launch-pro-badge">PRO</span>
				<p className="prisma-first-launch-pro-text">
					For more advanced workflows — Prisma Pro unlocks calendar sync, advanced visualizations, Bases integration,
					and other power-user capabilities built for serious planning inside Obsidian.
				</p>
				<Button
					testId={tid("pro-upgrade")}
					onClick={() =>
						window.open(
							welcomeUtm("https://matejvavroproductivity.com/tools/prisma-calendar/", "pro_callout"),
							"_blank",
							"noopener,noreferrer"
						)
					}
				>
					See what Pro unlocks
				</Button>
			</section>

			<section className="prisma-first-launch-thanks">
				<p>
					Thanks for giving Prisma a try. I hope you enjoy using it, and that it helps you become more productive and
					organized inside Obsidian. If you spot any bugs or see ways to improve it, don't hesitate to share your
					feedback through{" "}
					<a
						href={welcomeUtm("https://github.com/Real1tyy/Prisma-Calendar/issues", "feedback")}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub issues
					</a>
					.
				</p>
			</section>
		</WelcomeModalShell>
	);
});
