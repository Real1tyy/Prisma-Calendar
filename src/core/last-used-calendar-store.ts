import { LocalKV } from "@real1ty-obsidian-plugins";
import { z } from "zod";

const NAMESPACE = "prisma-calendar:state:last-used-calendar";
const SCOPE = "id";
const Schema = z.string();

/**
 * Device-local memory of which calendar the user most recently activated.
 * Lives in `localStorage` (not `sync.json`) because it's a per-device UI
 * hint — replicating it across vaults would cause two devices to fight
 * over which calendar opens first.
 */
export class LastUsedCalendarStore {
	private readonly kv = new LocalKV<string>({ namespace: NAMESPACE, schema: Schema });

	get(): string | null {
		return this.kv.get(SCOPE);
	}

	set(calendarId: string): void {
		if (this.get() === calendarId) return;
		this.kv.set(SCOPE, calendarId);
	}
}
