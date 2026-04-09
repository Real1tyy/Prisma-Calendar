import type { Frontmatter, VaultTableEvent } from "@real1ty-obsidian-plugins";
import { areSetsEqual, parseLinkedList, VaultTableView } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { BehaviorSubject, type Observable, type Subscription } from "rxjs";

import type { SingleCalendarConfig } from "../types";
import type { DependencyGraph } from "./dependency-graph";
import type { EventFileRepository } from "./event-file-repository";
import type { EventStore } from "./event-store";

/**
 * Tracks task dependencies (prerequisites → dependents) as a directed graph.
 * Extends VaultTableView over all tracked files — the view manages file lifecycle,
 * and the graph is rebuilt incrementally from view events.
 */
export class PrerequisiteTracker extends VaultTableView<Frontmatter> {
	private fileToPrerequisites = new Map<string, string[]>();
	private fileToDependents = new Map<string, Set<string>>();
	private connectedFiles = new Set<string>();
	private graphSubject = new BehaviorSubject<DependencyGraph>(new Map());

	private viewEventsSub: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private settings: SingleCalendarConfig;

	public readonly graph$: Observable<DependencyGraph>;

	constructor(
		private app: App,
		repo: EventFileRepository,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		super(repo.getTable(), { filter: () => true });

		this.settings = settingsStore.value;
		this.graph$ = this.graphSubject.asObservable();

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});

		this.viewEventsSub = this.events$.subscribe((event) => {
			this.handleViewEvent(event);
		});
	}

	// ─── View Event Handling ─────────────────────────────────────

	private handleViewEvent(event: VaultTableEvent<Frontmatter>): void {
		switch (event.type) {
			case "row-created":
				this.updateFileGraph(event.filePath, event.row.data);
				break;
			case "row-updated":
				this.updateFileGraph(event.filePath, event.newRow.data);
				break;
			case "row-deleted":
				this.removeFileFromGraph(event.filePath);
				break;
		}
	}

	// ─── Graph Mutations ─────────────────────────────────────────

	private linkPrerequisites(filePath: string, prereqs: string[]): void {
		this.fileToPrerequisites.set(filePath, prereqs);
		for (const prereq of prereqs) {
			let dependents = this.fileToDependents.get(prereq);
			if (!dependents) {
				dependents = new Set();
				this.fileToDependents.set(prereq, dependents);
			}
			dependents.add(filePath);
		}
	}

	private unlinkPrerequisites(filePath: string, prereqs: string[]): void {
		for (const prereq of prereqs) {
			const dependents = this.fileToDependents.get(prereq);
			if (dependents) {
				dependents.delete(filePath);
				if (dependents.size === 0) {
					this.fileToDependents.delete(prereq);
				}
			}
		}
	}

	private updateFileGraph(filePath: string, frontmatter: Frontmatter): void {
		const prerequisiteProp = this.settings.prerequisiteProp;
		if (!prerequisiteProp) return;

		const newPrereqs = this.resolveLinks(frontmatter[prerequisiteProp]);
		const oldPrereqs = this.fileToPrerequisites.get(filePath) ?? [];

		if (areSetsEqual(new Set(oldPrereqs), new Set(newPrereqs))) return;

		this.unlinkPrerequisites(filePath, oldPrereqs);

		if (newPrereqs.length > 0) {
			this.linkPrerequisites(filePath, newPrereqs);
		} else {
			this.fileToPrerequisites.delete(filePath);
		}

		this.rebuildConnectedFiles();
		this.notifyChange();
	}

	private removeFileFromGraph(filePath: string): void {
		const prereqs = this.fileToPrerequisites.get(filePath);
		if (prereqs) {
			this.unlinkPrerequisites(filePath, prereqs);
			this.fileToPrerequisites.delete(filePath);
		}
		const hadDependents = this.fileToDependents.delete(filePath);

		let removedDanglingRefs = false;
		for (const [file, filePrereqs] of this.fileToPrerequisites) {
			const filtered = filePrereqs.filter((p) => p !== filePath);
			if (filtered.length !== filePrereqs.length) {
				removedDanglingRefs = true;
				if (filtered.length > 0) {
					this.fileToPrerequisites.set(file, filtered);
				} else {
					this.fileToPrerequisites.delete(file);
				}
			}
		}

		if (prereqs || hadDependents || removedDanglingRefs) {
			this.rebuildConnectedFiles();
			this.notifyChange();
		}
	}

	/** Rebuilds the full dependency graph from EventStore — called after initial indexing */
	rebuildAll(): void {
		this.fileToPrerequisites.clear();
		this.fileToDependents.clear();
		this.connectedFiles.clear();

		const prerequisiteProp = this.settings.prerequisiteProp;
		if (!prerequisiteProp) {
			this.notifyChange();
			return;
		}

		for (const event of this.eventStore.getAllEvents()) {
			const prereqs = this.resolveLinks(event.meta[prerequisiteProp]);
			if (prereqs.length > 0) {
				this.linkPrerequisites(event.ref.filePath, prereqs);
			}
		}

		this.rebuildConnectedFiles();
		this.notifyChange();
	}

	// ─── Helpers ─────────────────────────────────────────────────

	private resolveLinks(value: unknown): string[] {
		return parseLinkedList(value, {
			resolve: (linkPath) => this.app.metadataCache.getFirstLinkpathDest(linkPath, "")?.path,
		});
	}

	private rebuildConnectedFiles(): void {
		this.connectedFiles.clear();
		for (const filePath of this.fileToPrerequisites.keys()) {
			this.connectedFiles.add(filePath);
		}
		for (const filePath of this.fileToDependents.keys()) {
			this.connectedFiles.add(filePath);
		}
	}

	private notifyChange(): void {
		this.graphSubject.next(new Map(this.fileToPrerequisites));
	}

	// ─── Public Query API ────────────────────────────────────────

	getPrerequisitesOf(filePath: string): string[] {
		return this.fileToPrerequisites.get(filePath) ?? [];
	}

	getDependentsOf(filePath: string): string[] {
		const dependents = this.fileToDependents.get(filePath);
		return dependents ? [...dependents] : [];
	}

	isConnected(filePath: string): boolean {
		return this.connectedFiles.has(filePath);
	}

	getGraph(): DependencyGraph {
		return this.fileToPrerequisites;
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	override destroy(): void {
		this.viewEventsSub?.unsubscribe();
		this.viewEventsSub = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.graphSubject.complete();
		super.destroy();
	}
}
