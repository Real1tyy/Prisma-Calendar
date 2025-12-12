# ZettelID Naming System

One of Prisma Calendar's core UX features is the **hidden ZettelID naming system**. This allows you to create unlimited events with the same user-facing name while maintaining unique file storage behind the scenes.

---

## 📝 The Problem

In a traditional calendar system, if you want to create multiple events with the same name, you face a dilemma:

- **Option A**: Add manual suffixes like "Meeting 1", "Meeting 2", "Meeting 3" (tedious and clutters the UI)
- **Option B**: Use different names for each event (loses consistency and semantic meaning)
- **Option C**: Face file naming conflicts (files overwrite each other)

None of these options are ideal for power users who value both efficiency and clean interfaces.

---

## ✨ The Solution: Hidden ZettelIDs

Prisma Calendar solves this elegantly by using **timestamp-based unique identifiers (ZettelIDs)** that are:

1. **Automatically appended** to filenames for uniqueness
2. **Automatically stripped** from the calendar display for cleanliness
3. **Invisible to the user** during all interactions (editing, previewing, viewing)

---

## 🎯 How It Works

### What You See vs. What's Stored

| Context | What You See |
|---------|--------------|
| **Calendar view** | `Team Meeting` |
| **Edit modal** | `Team Meeting` |
| **Preview modal** | `Team Meeting` |
| **Hover preview** | `Team Meeting` |
| **Enlarged view** | `Team Meeting` |

| Context | What's Actually Stored |
|---------|------------------------|
| **File system** | `Team Meeting-20250106143022.md` |
| **Vault browser** | `Team Meeting-20250106143022` |

### The ZettelID Format

A ZettelID is a 14-digit timestamp in the format: `-YYYYMMDDHHmmss`

**Example**: `-20250106143022`
- **2025** = Year
- **01** = January
- **06** = 6th day
- **14** = 14:00 hours (2 PM)
- **30** = 30 minutes
- **22** = 22 seconds

This timestamp ensures every filename is unique, even if created in rapid succession.

---

### **Cloning Events**

When you duplicate an event:
1. Original: `Project Review-20250103100000.md`
2. Clone: `Project Review-20250106152045.md` (new timestamp)
3. Both display as: `Project Review`

The calendar automatically generates a new unique ZettelID for the clone.

---

## ⚙️ Configuration

### Enabling Automatic ZettelID Generation

To have ZettelIDs automatically added to new events:

1. **Open Settings** → Prisma Calendar → **Properties Settings**
2. Set the **ZettelID property** field (e.g., `ZettelID`)
3. Create new events via the calendar interface

The calendar will:
- Append the ZettelID to the filename: `Event Title-20250106143022.md`
- Add the ZettelID to frontmatter: `ZettelID: 20250106143022`

### Example Frontmatter

```yaml
---
Title: Weekly Planning
Start: 2025-01-06T14:00
End: 2025-01-06T15:00
ZettelID: 20250106143022
---

Meeting notes go here...
```

### Manual Events (Without ZettelID Property)

Even if you don't configure a ZettelID property:
- Events created via the calendar will still use ZettelID-based filenames
- The ZettelID just won't be stored in frontmatter
- The calendar will still strip the ZettelID from display

---

### Collision Prevention

While timestamp collisions are extremely rare (requires creating two events in the same millisecond), the system handles them:

```typescript
// If "Event-20250106143022.md" exists
// Try "Event-20250106143023.md"
// And so on until a unique name is found
```

---

## 📌 Key Benefits

### ✅ **No Naming Conflicts**
Create unlimited events with the same name without worrying about file overwrites.

### ✅ **Clean User Experience**
Never see cluttered timestamp suffixes in the calendar interface.

### ✅ **Semantic Consistency**
Use meaningful, consistent event names without manual numbering.

### ✅ **Automatic Management**
The calendar handles all naming complexity behind the scenes.

### ✅ **Full Feature Compatibility**
Works seamlessly with:
- Recurring events
- Batch operations (clone, move, delete)
- Event editing and previews
- Drag-and-drop operations
- Undo/redo system

### ✅ **Optional Frontmatter Storage**
Store the ZettelID in frontmatter for additional tracking if needed.

---

## ❓ Common Questions

### Do I need to configure ZettelID to use this feature?

**No.** The hidden naming system works automatically for all events created via the calendar, whether or not you configure a ZettelID frontmatter property. Configuring the property just stores the ZettelID in frontmatter as well.

### Can I see the ZettelID somewhere?

**Yes.** The ZettelID is always visible in:
- The file browser in Obsidian's sidebar
- The file system (if you browse your vault externally)
- The frontmatter (if you configured a ZettelID property)

It's just hidden from the *calendar interface* to keep the UI clean.

### What if I manually rename a file to remove the ZettelID?

The calendar will still display the file correctly. However, removing the ZettelID manually:
- Increases risk of filename collisions
- May cause issues if you later create an event with the same name
- Is not recommended

### Does this work with events I create manually (outside the calendar)?

**Partially.** Prisma Calendar only recognizes its own ZettelID format:

If you manually create a note **with Prisma's ZettelID format** (e.g., `Meeting-20250106120000.md`):
- The calendar will display it as `Meeting` (ZettelID stripped)
- When cloning/moving the event, Prisma **preserves** the existing ZettelID and does NOT add a new one
- This prevents double-timestamping issues

**Recognized format:**
- Prisma native only: `-YYYYMMDDHHmmss` (exactly 14 digits)

**Example:**
```
Manual file with Prisma format: Meeting-20250106120000.md
Display: Meeting
Clone: Meeting-20250106120000.md (same ZettelID preserved)
```

If you manually create a note **with other timestamp formats** (e.g., `Meeting-20250106-1430.md`):
- The calendar will display the full filename including the timestamp
- When cloning/moving, Prisma will ADD its own ZettelID: `Meeting-20250106-1430-20250112153045.md`
- This may result in double timestamps

**Recommendation:** For best results, create events via the calendar interface, or use Prisma's exact ZettelID format (`-YYYYMMDDHHmmss`) when creating files manually.

### Can I customize the ZettelID format?

Currently, the format (`-YYYYMMDDHHmmss`) is fixed. This ensures consistency across all calendars and prevents parsing ambiguities.
