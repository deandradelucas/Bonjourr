import { gridFindObject, trimGridEdges } from './helpers.ts'
import { setGridAreas } from './dom.ts'
import { storage } from '../../storage.ts'

import type { Direction, WidgetInGrid } from './helpers.ts'
import type { SimpleMove } from '../../../types/sync.ts'
import type { WidgetName } from '../../../types/shared.ts'

export function gridShrink(move: SimpleMove, id: WidgetName, direction: Direction): void {
    const widget = gridFindObject(move.grid, id)
    const grid = move.grid

    if (!widget.positions.length) {
        return
    }
    if (!canShrink(widget, direction)) {
        return
    }

    if (direction === 'up') {
        const minRow = Math.min(...widget.positions.map((p) => p.row))
        for (const { col, row } of widget.positions) {
            if (row === minRow) {
                grid[row][col] = '.'
            }
        }
    }

    if (direction === 'down') {
        const maxRow = Math.max(...widget.positions.map((p) => p.row))
        for (const { col, row } of widget.positions) {
            if (row === maxRow) {
                grid[row][col] = '.'
            }
        }
    }

    if (direction === 'left') {
        const minCol = Math.min(...widget.positions.map((p) => p.col))
        for (const { col, row } of widget.positions) {
            if (col === minCol) {
                grid[row][col] = '.'
            }
        }
    }

    if (direction === 'right') {
        const maxCol = Math.max(...widget.positions.map((p) => p.col))
        for (const { col, row } of widget.positions) {
            if (col === maxCol) {
                grid[row][col] = '.'
            }
        }
    }

    trimGridEdges(move.grid)
    setGridAreas(move.grid)
    storage.sync.set({ move })
}

export function canShrink(widget: WidgetInGrid, direction: Direction): boolean {
    const isHorizontal = direction === 'left' || direction === 'right'
    const isVertical = direction === 'up' || direction === 'down'

    if (isHorizontal) {
        return widget.width > 1
    }
    if (isVertical) {
        return widget.height > 1
    }

    return false
}
