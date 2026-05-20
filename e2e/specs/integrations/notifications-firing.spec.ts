import { dateOffsetMinutes, localISOWithSeconds } from "../../fixtures/dates";
import { expect, testWithNotifications as test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// `enableNotifications: true` is seeded into the calendar config by
// `testWithNotifications`. The full notification path under test:
//   indexer file-changed → NotificationManager.processEventSource →
//   calculateNotificationTime (uses Minutes Before frontmatter) →
//   notifyAt < now AND timeSinceEvent < MAX_PAST_NOTIFICATION_THRESHOLD →
//   triggerNotification → showNotificationModal → on-disk Already Notified
//   frontmatter set.
//
// To trigger the modal in a test we seed an event with start time just past
// "now" and a Minutes Before value large enough that notifyAt has already
// elapsed — e.g., start = now + 2 min, Minutes Before = 10 min → notifyAt
// is now − 8 min, comfortably inside the 5-hour past threshold. The modal
// then renders synchronously when the indexer ingests the file.

const NOTIFICATION_MODAL_TID = "prisma-notification-modal";
const NOTIFICATION_DISMISS_TID = "prisma-notification-dismiss";
// Time between indexer pass and assertion for the negative-case (modal must NOT
// appear). The positive case is fenced by `expect(modal).toBeVisible()` instead.
const NEGATIVE_CASE_GRACE_MS = 750;
const EVENT_START_OFFSET_MIN = 2;
const EVENT_DURATION_MIN = 30;
const MINUTES_BEFORE_TRIGGER = 10;

function notifiableFrontmatter(extra: Record<string, string | boolean> = {}): Record<string, string | boolean> {
	const start = dateOffsetMinutes(EVENT_START_OFFSET_MIN);
	const end = new Date(start.getTime() + EVENT_DURATION_MIN * 60_000);
	return {
		"Start Date": localISOWithSeconds(start),
		"End Date": localISOWithSeconds(end),
		"Minutes Before": String(MINUTES_BEFORE_TRIGGER),
		...extra,
	};
}

test.describe("notifications: reminder modal fires from indexer events", () => {
	test("event whose notifyAt has elapsed pops the notification modal on indexer ingestion", async ({ calendar }) => {
		// notifyAt = startDate − 10min = now − 8min — already past, but
		// timeSinceEvent (now − startDate) = −2min, well within the 5-hour
		// future-event grace window. Triggers immediately on the indexer pass.
		const event = await calendar.seedOnDisk("Notify Me", notifiableFrontmatter());

		// Exactly one notification modal — `NotificationManager.triggering`
		// dedupes the create+modify file-change pair the indexer emits on a
		// seed write. If this count climbs above 1, the source-level dedupe
		// regressed; do not paper over it here.
		const modal = calendar.page.locator(sel(NOTIFICATION_MODAL_TID));
		await expect(modal).toHaveCount(1);
		await expect(modal).toContainText("Notify Me");

		await calendar.page.locator(sel(NOTIFICATION_DISMISS_TID)).click();
		await expect(modal).toHaveCount(0);

		// After firing, the manager writes `Already Notified: true` so the same
		// event won't fire again on the next indexer pass — the file's
		// frontmatter must reflect that.
		await event.expectFrontmatter("Already Notified", (v) => v === true);
	});

	test("event with Already Notified: true does NOT fire the modal", async ({ calendar }) => {
		// Same shape as above except for the explicit Already Notified flag —
		// the manager's processEventSource short-circuits on that frontmatter
		// before computing notifyAt.
		await calendar.seedOnDisk("Already Done", notifiableFrontmatter({ "Already Notified": true }));

		// Negative case — the absence of the modal needs a small grace window
		// after the indexer ingests the seed (the notification manager runs
		// asynchronously off the indexer pass).
		await calendar.page.waitForTimeout(NEGATIVE_CASE_GRACE_MS);

		await expect(calendar.page.locator(sel(NOTIFICATION_MODAL_TID))).toHaveCount(0);
	});
});
