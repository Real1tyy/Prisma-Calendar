# ZettelID Naming System

Create unlimited events with identical display names while maintaining unique file storage behind the scenes.

## How It Works

Prisma Calendar uses **timestamp-based unique identifiers (ZettelIDs)** that are automatically appended to filenames but stripped from the calendar display.

**Display**: `Team Meeting` (everywhere in the calendar UI)

**Storage**: `Team Meeting-20250106143022.md` (file system and vault browser)

## ZettelID Format

Format: `-YYYYMMDDHHmmss` (14-digit timestamp)

Example: `-20250106143022` = January 6, 2025 at 14:30:22

This ensures every filename is unique, even when creating multiple events rapidly.

## Configuration

**Optional**: Configure a ZettelID property in Settings → Properties to store the ZettelID in frontmatter.

**Note**: ZettelID filenames work automatically whether or not you configure the property. The property just adds the ZettelID to frontmatter for additional tracking.

```yaml
---
Title: Weekly Planning
ZettelID: 20250106143022
---
```

## Benefits

- Create unlimited events with identical names
- Clean UI without timestamp clutter
- Automatic collision prevention
- Works with all calendar features ([recurring events](./recurring-dsl.md), [batch operations](./batch-operations.md), [undo/redo](./undo-redo.md))

## Manual Events

**Prisma format** (`-YYYYMMDDHHmmss`): ZettelID is recognized and stripped from display. When cloning, the existing ZettelID is preserved.

**Other formats** (e.g., `Meeting-2025-01-06.md`): Full filename displayed. Cloning adds a new ZettelID, resulting in double timestamps.

**Recommendation**: Create events via the calendar interface for best results.
