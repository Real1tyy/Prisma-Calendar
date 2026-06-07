import { LocalKV } from "@real1ty-obsidian-plugins";
import { z } from "zod";

const NAMESPACE = "prisma-calendar:state:first-index-notice";
const Schema = z.boolean();

/**
 * Device-local memory of which calendars have already shown their one-shot
 * "first index" count notice. Lives in `localStorage` (not `sync.json`) so the
 * notice fires once per device on first use, without nagging on every launch and
 * without replicating across vaults.
 */
export class FirstIndexNoticeStore {
	private readonly kv = new LocalKV<boolean>({ namespace: NAMESPACE, schema: Schema });

	/** Marks the notice shown for this calendar; returns false if it had already fired. */
	claim(calendarId: string): boolean {
		if (this.kv.get(calendarId) === true) return false;
		this.kv.set(calendarId, true);
		return true;
	}
}
