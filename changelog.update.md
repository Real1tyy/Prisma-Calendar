### Fixed

- **Duplicating a recurring event no longer starts a second series**: duplicating, batch-duplicating or cloning the recurring source note copied its `RRule` but not its `RRuleID`, so the copy became a brand-new series that generated its own instances. Every duplicate is now a plain one-off event with all recurrence properties removed, and the original series is left untouched.
