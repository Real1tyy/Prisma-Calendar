### Fixed

- Renaming a recurring event's source note renames its generated instances to the new title, keeping each instance's date.
- Categories, name series and prerequisite arrows keep updating after you change a calendar's event folder, without reloading Obsidian.
- A CalDAV or ICS event whose date you remove stays linked to its calendar, so the next sync doesn't create a second copy of it.
- Removing the recurrence from a note stops its repeating occurrences on the calendar straight away, instead of after a reload; adding it back picks up the instances already on disk.
