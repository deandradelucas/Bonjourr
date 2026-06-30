import { gridFindObject, isValidGrid, MOVE_WIDGETS, rowOfDots, trimGridEdges } from './helpers.ts'
import { setGridAreas } from './dom.ts'
import { storage } from '../../storage.ts'

import type { Direction, Grid, WidgetInGrid } from './helpers.ts'
import type { SimpleMove } from '../../../types/sync.ts'
import type { WidgetName } from '../../../types/shared.ts'

type WidgetSize = { width: number; height: number }
type WidgetSizes = Map<WidgetName, WidgetSize>

/*
 * grid.ts and grow.ts have the same file structure
 */

export function gridGrow(move: SimpleMove, id: WidgetName, direction: Direction): void {
    const grid = growWidgetInGrid(move, id, direction)

    if (!isValidGrid(grid)) {
        return
    }

    move.grid = grid
    setGridAreas(move.grid)
    storage.sync.set({ move })
}

export function canGrow(move: SimpleMove, id: WidgetName, direction: Direction): boolean {
    try {
        return isValidGrid(growWidgetInGrid(move, id, direction))
    } catch (_) {
        return false
    }
}

/** Step 0 */
function growWidgetInGrid(move: SimpleMove, id: WidgetName, direction: Direction): Grid {
    const widget = gridFindObject(move.grid, id)

    if (!widget.positions.length) {
        throw new Error('Widget not found in grid')
    }

    const clone = structuredClone(move) as SimpleMove
    const cloneWidget = gridFindObject(clone.grid, id)

    addGridEdgesForGrow(clone, direction, cloneWidget, id)
    expandWidget(clone, id, cloneWidget, direction)
    trimGridEdges(clone.grid)

    return clone.grid
}

/** Step 1: Add grid edges if the widget is at the edge */
function addGridEdgesForGrow(move: SimpleMove, dir: Direction, widget: WidgetInGrid, _id: WidgetName): void {
    const grid = move.grid

    const isBottom = isWidgetAtEdge(grid, widget, 'down')
    const isRight = isWidgetAtEdge(grid, widget, 'right')
    const isLeft = isWidgetAtEdge(grid, widget, 'left')
    const isTop = isWidgetAtEdge(grid, widget, 'up')

    if (dir === 'up' && isTop) {
        move.grid.unshift(rowOfDots(move.grid))

        // Update all widget positions after adding row at top
        for (const widgetId of MOVE_WIDGETS) {
            const { positions } = gridFindObject(move.grid, widgetId)

            for (const position of positions) {
                position.row++
            }
        }
    }

    if (dir === 'left' && isLeft) {
        for (const row of move.grid) {
            row.unshift('.')
        }

        // Update all widget positions after adding column at left
        for (const widgetId of MOVE_WIDGETS) {
            const { positions } = gridFindObject(move.grid, widgetId)

            for (const position of positions) {
                position.col++
            }
        }
    }

    if (dir === 'down' && isBottom) {
        move.grid.push(rowOfDots(move.grid))
    }

    if (dir === 'right' && isRight) {
        for (const row of move.grid) {
            row.push('.')
        }
    }
}

/** Step 2: Expand the widget by 1 cell in the given direction */
function expandWidget(move: SimpleMove, id: WidgetName, widget: WidgetInGrid, dir: Direction): void {
    const grid = move.grid
    const positions = widget.positions
    const displacedWidgets = new Set<WidgetName>()
    const targetCells: { col: number; row: number }[] = []

    const maxRow = Math.max(...positions.map((p) => p.row))
    const minRow = Math.min(...positions.map((p) => p.row))
    const maxCol = Math.max(...positions.map((p) => p.col))
    const minCol = Math.min(...positions.map((p) => p.col))

    for (const { row, col } of positions) {
        if (dir === 'down' && row === maxRow) {
            targetCells.push({ col, row: row + 1 })
        }
        if (dir === 'up' && row === minRow) {
            targetCells.push({ col, row: row - 1 })
        }
        if (dir === 'right' && col === maxCol) {
            targetCells.push({ row, col: col + 1 })
        }
        if (dir === 'left' && col === minCol) {
            targetCells.push({ row, col: col - 1 })
        }
    }

    for (const { col, row } of targetCells) {
        const cellId = grid[row][col]
        const isOtherWidget = cellId !== '.' && cellId !== id

        if (isOtherWidget) {
            displacedWidgets.add(cellId as WidgetName)
        }
    }

    for (const displacedId of displacedWidgets) {
        pushWidget(move, displacedId, dir)
    }

    for (const { col, row } of targetCells) {
        grid[row][col] = id
    }
}

/** Step 3: Push a widget in the given direction */
function pushWidget(move: SimpleMove, id: WidgetName, dir: Direction): void {
    const widget = gridFindObject(move.grid, id)
    const grid = move.grid

    if (!widget.positions.length) {
        return
    }

    // Calculate how far to push
    let pushDistance = 1

    // Add grid edges if needed
    const isAtEdge = isWidgetAtEdge(grid, widget, dir)
    if (isAtEdge) {
        if (dir === 'down') {
            move.grid.push(rowOfDots(move.grid))
        }
        if (dir === 'right') {
            for (const row of move.grid) {
                row.push('.')
            }
        }
        if (dir === 'up') {
            move.grid.unshift(rowOfDots(move.grid))
            pushDistance = 0 // Widget stays in place, grid expanded above
        }
        if (dir === 'left') {
            for (const row of move.grid) {
                row.unshift('.')
            }
            pushDistance = 0 // Widget stays in place, grid expanded to left
        }
    }

    // Clear current positions
    for (const { col, row } of widget.positions) {
        grid[row][col] = '.'
    }

    // Place widget in new positions
    for (const { col, row } of widget.positions) {
        let newRow = row
        let newCol = col

        if (dir === 'down') newRow += pushDistance
        if (dir === 'up') newRow -= pushDistance
        if (dir === 'right') newCol += pushDistance
        if (dir === 'left') newCol -= pushDistance

        // Check if new position has another widget
        const cellContent = grid[newRow][newCol]
        if (cellContent !== '.' && cellContent !== id) {
            // Recursively push the blocking widget
            pushWidget(move, cellContent as WidgetName, dir)
        }

        grid[newRow][newCol] = id
    }
}

/**
 * Helper functions
 */

function isWidgetAtEdge(grid: Grid, widget: WidgetInGrid, dir: Direction): boolean {
    const cols = widget.positions.map((p) => p.col)
    const rows = widget.positions.map((p) => p.row)
    const lastCol = grid[0].length - 1
    const lastRow = grid.length - 1

    switch (dir) {
        case 'up':
            return Math.min(...rows) === 0
        case 'right':
            return Math.max(...cols) === lastCol
        case 'down':
            return Math.max(...rows) === lastRow
        case 'left':
            return Math.min(...cols) === 0
    }
}
