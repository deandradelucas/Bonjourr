# Move Feature

The Move feature provides a UI for rearranging, resizing, and aligning widgets on the new‑tab page.

## Core Concepts
- **Widget** – a UI component (time, main, quicklinks, notes, quotes, searchbar, pomodoro).
- **Grid** – a 2‑D array of widget IDs (`string[][]`). Empty cells are `'.'`.
- **Direction** – one of `up`, `down`, `left`, `right`. Used for moving, growing, and shrinking widgets.

## Main Modules
| File | Purpose |
|------|---------|
| `dom.ts` | Applies CSS grid (`setGridAreas`), aligns widgets (`setAlign`, `setAllAligns`), manages overlay/toolbar lifecycle, and wires overlay button handlers. |
| `grid.ts` | Implements `gridMove` – mutates the grid to move a widget one cell, handling edge expansion, optimistic swap, collision fixing, and trimming. |
| `grow.ts` | Implements `gridGrow` – expands a widget by one cell in a direction, pushing displaced widgets and trimming. |
| `shrink.ts` | Implements `gridShrink` – removes one edge row/col of a widget, replacing those cells with `'.'` and trimming. No-ops if the widget is already 1 cell in that dimension. |
| `helpers.ts` | Shared utilities: grid parse/stringify/find, widget lookup (`gridFind`, `gridFindObject`), storage helpers, health check (`isDomHealthy`), span logic, and shared grid helpers (`trimGridEdges`, `isRowEmpty`, `isColumnEmpty`, `rowOfDots`). |
| `index.ts` | Central controller (`moveElements`, `updateMoveElement`). Defines `UpdateMove` payload, queues health checks, routes to `gridMove`, `gridGrow`, `gridShrink`, alignment, reset, and toggle. |
| `widgets.ts` | Toggles widget visibility with a CSS transition, updates overlay presence, and syncs settings inputs. |

## Workflow
1. **Overlay Actions** – Buttons in the overlay call `moveElements(undefined, { id, move: '<direction>' })` for moving, `{ id, grow: '<direction>' }` for growing, or `{ id, shrink: '<direction>' }` for shrinking.
2. **Update Move** – `updateMoveElement` receives an `UpdateMove` object, loads current `Sync` state, and dispatches to:
   - `gridMove` (directional move)
   - `gridGrow` (directional grow)
   - `gridShrink` (directional shrink)
   - `alignChange` (horizontal / vertical / text alignment)
   - Reset, toggle, and overlay flags.
3. **Grid Manipulation** – `gridMove` and `gridGrow` follow a multi-step process:
   1. **Add edges** if the widget touches a grid border.
   2. **Swap/expand** the widget's cells.
   3. **Fix collisions** (push overlapping widgets, ensure rectangles).
   4. **Trim** empty rows/columns from all edges (shared `trimGridEdges` from `helpers.ts`).
   5. **Persist** changes (`storage.sync.set`) and update CSS (`setGridAreas`).

   `gridShrink` is simpler — no edge expansion or collision fixing needed since shrinking only creates empty space.

## HTML Templates (`index.html`)
Two `<template>` elements drive the overlay UI:

- **`move-toolbar-template`** – a `<ul id="move-toolbar">` appended to `<body>` while editing. Contains a Preview button that temporarily adds `move-preview` to `#interface` (hides overlays via CSS).
- **`move-overlay-template`** – a `.move-overlay` div appended to `#interface` for each active widget. Contains:
  - `.move-overlay-grid` – four directional move buttons (`move-grid-*`), grow (`move-grow-*`), and shrink (`move-shrink-*`) buttons per direction.
  - `.move-overlay-align` – three range sliders for vertical, horizontal, and text alignment.

## Known Issues / TODOs
- **`fixGridCollisions` stub in `grow.ts`** – the loop detects non-rectangular widgets but takes no corrective action; it relies entirely on the `pushWidget` step.
- **`pageWidthOverlay`** – commented out in `index.ts`.

## Usage Example
```ts
// Move widget #main down one row
moveElements(undefined, { id: 'main', move: 'down' });

// Grow widget #quotes to the right
moveElements(undefined, { id: 'quotes', grow: 'right' });

// Shrink widget #notes from the bottom
moveElements(undefined, { id: 'notes', shrink: 'down' });
```
