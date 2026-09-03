---
sidebar_position: 8
---

# Note Content

The Create Event and Edit Event modals include **Note content** at the bottom of the form. Use it for agendas, meeting notes, links, or any other Markdown text that belongs in the event note.

Creating an event writes the usual frontmatter and then the typed content. When a Templater template is configured, Prisma writes the rendered template body first and appends the typed content after it. Leaving the field empty preserves the usual file output.

When editing an existing event, the field starts with the note's current body. If the note changes in another pane while the field is untouched, its value updates. If you have typed in the field, Prisma keeps your draft and shows a conflict notice; saving then asks you to confirm before replacing the changed body. Undo restores the previous frontmatter and body together after a body edit.

Select **Note content** in the modal header, or press `Ctrl/Cmd+Shift+N`, to scroll to and focus the field. The keyboard shortcut is always available. To hide the header button, turn off **Show jump to note content button** in **Settings → General → Event defaults**.

Virtual events have no backing note, so they do not show the field.
