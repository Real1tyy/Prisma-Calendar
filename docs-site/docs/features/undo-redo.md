# Undo/Redo System

Prisma Calendar implements a powerful **Command Pattern** based undo/redo system that provides fine-grained, semantic undo functionality for all calendar operations.

## Overview

The Command pattern is perfect for calendar systems because it provides:

- **Invertible operations**: Each command knows how to undo itself
- **Memory-light**: Store command objects instead of full state snapshots
- **Semantic undo**: "Undo event creation" vs generic state rollback
- **Composable**: Batch operations can be grouped into macro commands
- **Fine-grained history**: Each operation is tracked individually

## How It Works

### Command Pattern Architecture

```typescript
interface Command {
  execute(): Promise<void>;     // Perform the operation
  undo(): Promise<void>;        // Reverse the operation
  getDescription(): string;     // Human-readable description
  getType(): string;           // Command type identifier
  canUndo?(): Promise<boolean>; // Check if undo is still possible
}
```

### Per-Calendar History

Each calendar maintains its own independent command history:

- **Separate undo/redo stacks** for each calendar view
- **50 commands maximum** history per calendar (configurable)
- **Memory cleanup** when calendars are closed
- **State isolation** between different calendars

### Supported Operations

All major calendar operations support undo/redo:

#### Single Event Operations
- **Create Event**: Undo removes the created file
- **Edit Event**: Undo restores original frontmatter values
- **Delete Event**: Undo recreates the file with original content
- **Move Event**: Undo restores original date/time
- **Clone Event**: Undo removes the cloned file

#### Batch Operations
- **Batch Delete**: Undo restores all deleted events
- **Batch Duplicate**: Undo removes all duplicated events
- **Batch Move**: Undo moves all events back to original times
- **Batch Clone**: Undo removes all cloned events

## Usage

### Keyboard Shortcuts

Set up keyboard shortcuts in Obsidian's hotkey settings:

- **Undo**: Reverses the last operation in the active calendar
- **Redo**: Re-applies the last undone operation

### Command Descriptions

The system provides human-readable descriptions for each operation:

- `"Create Event: Team Meeting"`
- `"Delete 3 Events"`
- `"Move Event to Next Week"`
- `"Batch: Clone 5 Events to Previous Week"`

### Visual Feedback

- **Success notifications** when operations complete
- **"Nothing to undo/redo"** messages when stacks are empty
- **Error handling** with graceful degradation

## Technical Implementation

### CommandManager

Each calendar bundle contains a `CommandManager` that:

- **Executes commands** and adds them to the undo stack
- **Manages undo/redo stacks** with size limits
- **Validates operations** before undoing
- **Emits events** for UI updates
- **Handles failures** gracefully

### MacroCommand

Batch operations use `MacroCommand` to group multiple commands:

```typescript
const batchDelete = new MacroCommand('Delete Selected Events', [
  new DeleteEventCommand(app, bundle, 'event1.md'),
  new DeleteEventCommand(app, bundle, 'event2.md'),
  new DeleteEventCommand(app, bundle, 'event3.md')
]);

await bundle.commandManager.executeCommand(batchDelete);
```

### Event Commands

Specific command implementations for calendar operations:

- `CreateEventCommand`: Creates new event files using template service
- `DeleteEventCommand`: Removes files and stores content for undo
- `EditEventCommand`: Updates frontmatter and preserves original values
- `MoveEventCommand`: Modifies date/time properties with offset calculations
- `CloneEventCommand`: Creates duplicates with unique filenames and IDs

## Error Handling

### Robust Failure Recovery

- **Command execution failures** don't corrupt the history
- **Undo failures** leave commands in place for retry
- **Resource validation** checks if files still exist before undo
- **Graceful degradation** when operations can't be undone

### File System Safety

- **Atomic operations** using Obsidian's file manager API
- **Frontmatter preservation** for all non-calendar properties
- **Unique filename generation** to avoid conflicts
- **Template integration** for consistent file creation

## Benefits

### Memory Efficiency

Unlike traditional undo systems that store full state snapshots, the Command pattern only stores:
- Command objects (lightweight)
- Minimal state data needed for reversal
- No duplicate file contents or complex state trees

### Semantic Operations

Users see meaningful undo descriptions:
- "Undo Create Event: Doctor Appointment"
- "Undo Move 3 Events to Next Week"
- "Undo Batch Delete (5 operations)"

### Composability

Complex workflows become single undoable units:
- Select 10 events → Move to next week = One undo operation
- Batch create from template → Edit properties = Separate undo operations
- Clone recurring events → Modify times = Granular undo control

## Future Enhancements

### Planned Features

- **Command history UI** showing list of undoable operations
- **Selective undo** to undo specific operations out of order
- **Command persistence** across Obsidian restarts
- **Undo branches** for complex editing workflows
- **Command macros** for recorded operation sequences

### Integration Points

- **Plugin settings** for history size and behavior
- **Status bar indicators** for undo/redo availability  
- **Context menu integration** for per-event undo options
- **Templater hooks** for custom command creation