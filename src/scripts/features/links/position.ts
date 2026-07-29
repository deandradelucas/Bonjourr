import { storage } from '../../storage.ts'

import type { Sync } from '../../../types/sync.ts'

const domlinkmini = document.getElementById('link-mini') as HTMLDivElement
const ICONS_LAYOUTS: NonNullable<Sync['linkgroups']['iconsLayout']>[] = ['row', 'grid', 'stack']

export function applyGroupPosition(data: Sync): void {
    const { position, positionLocked, iconsLayout } = data.linkgroups
    const lockBtn = document.getElementById('link-mini-lock')
    const layoutBtn = document.getElementById('link-mini-layout')

    if (position) {
        domlinkmini.style.setProperty('--pos-x', `${position.x}%`)
        domlinkmini.style.setProperty('--pos-y', `${position.y}%`)
        domlinkmini.classList.add('free-position')
    } else {
        domlinkmini.classList.remove('free-position')
        domlinkmini.style.removeProperty('--pos-x')
        domlinkmini.style.removeProperty('--pos-y')
    }

    domlinkmini.classList.toggle('position-locked', !!positionLocked)

    for (const layout of ICONS_LAYOUTS) {
        domlinkmini.classList.toggle(`icons-${layout}`, layout === (iconsLayout ?? 'row'))
    }

    if (lockBtn) {
        lockBtn.textContent = positionLocked ? '🔒' : '🔓'
    }

    if (layoutBtn) {
        layoutBtn.dataset.layout = iconsLayout ?? 'row'
    }
}

export function initGroupPositionEvents(): void {
    document.getElementById('link-mini-drag')?.addEventListener('pointerdown', startPositionDrag)
    document.getElementById('link-mini-lock')?.addEventListener('click', togglePositionLock)
    document.getElementById('link-mini-layout')?.addEventListener('click', cycleIconsLayout)
}

async function cycleIconsLayout(): Promise<void> {
    const data = await storage.sync.get()
    const current = data.linkgroups.iconsLayout ?? 'row'
    const next = ICONS_LAYOUTS[(ICONS_LAYOUTS.indexOf(current) + 1) % ICONS_LAYOUTS.length]

    data.linkgroups.iconsLayout = next
    storage.sync.set(data)
    applyGroupPosition(data)
}

async function togglePositionLock(): Promise<void> {
    const data = await storage.sync.get()
    data.linkgroups.positionLocked = !data.linkgroups.positionLocked
    storage.sync.set(data)
    applyGroupPosition(data)
}

function startPositionDrag(event: PointerEvent): void {
    if (domlinkmini.classList.contains('position-locked')) {
        return
    }

    event.preventDefault()

    const rect = domlinkmini.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY

    domlinkmini.classList.add('dragging-position')
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)

    function move(e: PointerEvent): void {
        const x = ((rect.left + (e.clientX - startX)) / globalThis.innerWidth) * 100
        const y = ((rect.top + (e.clientY - startY)) / globalThis.innerHeight) * 100

        domlinkmini.classList.add('free-position')
        domlinkmini.style.setProperty('--pos-x', `${x}%`)
        domlinkmini.style.setProperty('--pos-y', `${y}%`)
    }

    async function up(): Promise<void> {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        domlinkmini.classList.remove('dragging-position')

        const x = Number.parseFloat(domlinkmini.style.getPropertyValue('--pos-x'))
        const y = Number.parseFloat(domlinkmini.style.getPropertyValue('--pos-y'))

        const data = await storage.sync.get()
        data.linkgroups.position = { x, y }
        storage.sync.set(data)
    }
}
