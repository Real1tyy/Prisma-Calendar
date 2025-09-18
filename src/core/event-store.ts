import { DateTime } from "luxon";
import { Subject, type Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { ISO } from "../types/index";
import type { Indexer, IndexerEvent, RawEventSource } from "./indexer";
import type { ParsedEvent, Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";

export interface EventQuery {
	start: ISO;
	end: ISO;
}

export interface VaultEventId {
	filePath: string;
}

export interface CachedEvent {
	template: ParsedEvent;
	mtime: number;
}

export class EventStore {
	private cache = new Map<string, CachedEvent>();
	private changeSubject = new Subject<void>();
	private subscription: Subscription | null = null;
	public readonly changes$ = this.changeSubject.asObservable();

	constructor(
		private indexer: Indexer,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager
	) {
		this.subscription = this.indexer.events$
			.pipe(
				filter(
					(event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"
				)
			)
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
		}
	}

	private processFileChange(source: RawEventSource): void {
		if (this.isUpToDate(source.filePath, source.mtime)) {
			return;
		}

		const event = this.parser.parseEventSource(source);

		if (event) {
			this.updateEvent(source.filePath, event, source.mtime);
		} else {
			this.invalidate(source.filePath);
		}
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.changeSubject.complete();
		this.clear();
	}

	updateEvent(filePath: string, template: ParsedEvent, mtime: number): void {
		this.cache.set(filePath, { template, mtime });
		this.notifyChange();
	}

	invalidate(filePath: string): void {
		if (this.cache.delete(filePath)) {
			this.notifyChange();
		}
	}

	isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	async getEvents(query: EventQuery): Promise<ParsedEvent[]> {
		const results: ParsedEvent[] = [];
		const queryStart = DateTime.fromISO(query.start);
		const queryEnd = DateTime.fromISO(query.end);

		for (const cached of this.cache.values()) {
			const { template: event } = cached;
			if (this.eventIntersectsRange(event, queryStart, queryEnd)) {
				results.push(event);
			}
		}
		const virtualEvents = await this.recurringEventManager.generateAllVirtualInstances(
			queryStart,
			queryEnd
		);
		results.push(...virtualEvents);

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	clear(): void {
		this.cache.clear();
		this.notifyChange();
	}

	subscribe(observer: () => void): Subscription {
		return this.changes$.subscribe(observer);
	}

	private eventIntersectsRange(
		event: ParsedEvent,
		rangeStart: DateTime,
		rangeEnd: DateTime
	): boolean {
		const eventStart = DateTime.fromISO(event.start);
		const eventEnd = event.end ? DateTime.fromISO(event.end) : eventStart.endOf("day");

		return eventStart < rangeEnd && eventEnd > rangeStart;
	}

	private notifyChange(): void {
		try {
			this.changeSubject.next();
		} catch (error) {
			console.error("Error notifying EventStore change:", error);
		}
	}
}
