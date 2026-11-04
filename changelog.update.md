### Fixed

- **Undo and redo are more reliable**: Redo always re-applies the step you just undid, and once you make a new change there is nothing left for Redo to bring back, so an older edit can never overwrite a newer one. Undo then reverses exactly what is in your note. The steps Redo can no longer reach aren't lost: they stay in Operation history, where you can re-apply any of them from its row. See [Undo/Redo → How undo and redo pick a step](./features/management/undo-redo.md#how-undo-and-redo-pick-a-step).
- **Operation history is wider**: the history window is wider and still fits narrow windows, so event names are no longer cut off next to the Undo and Revert buttons.
