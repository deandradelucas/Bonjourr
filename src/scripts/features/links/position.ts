import { storage } from '../../storage.ts'

import type { Sync } from '../../../types/sync.ts'

export const LOCK_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" width="1em" height="1em"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>'

export const UNLOCK_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" width="1em" height="1em"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.6"/></svg>'

// Per-group free positioning, lock, and dark bubble theme

export function applyGroupAppearance(button: HTMLButtonElement, group: string, data: Sync): void {
    const { positions, locked, darkBubbles, transparentBubbles, iconsLayouts } = data.linkgroups
    const pos = positions?.[group]
    const isLocked = !!locked?.includes(group)
    const isDark = !!darkBubbles?.includes(group)
    const isTransparent = !!transparentBubbles?.includes(group)
    const isGrid = (iconsLayouts?.[group] ?? 'row') === 'grid'

    if (pos) {
        button.style.setProperty('--pos-x', `${pos.x}%`)
        button.style.setProperty('--pos-y', `${pos.y}%`)
        button.classList.add('free-position')
    } else {
        button.classList.remove('free-position')
        button.style.removeProperty('--pos-x')
        button.style.removeProperty('--pos-y')
    }

    button.classList.toggle('position-locked', isLocked)
    button.classList.toggle('dark-bubble', isDark)
    button.classList.toggle('transparent-bubble', isTransparent)
    button.classList.toggle('icons-grid', isGrid)

    const lockBtn = button.querySelector<HTMLElement>('.group-lock')
    const darkBtn = button.querySelector<HTMLElement>('.group-dark')
    const shapeBtn = button.querySelector<HTMLElement>('.group-shape')
    const transparentBtn = button.querySelector<HTMLElement>('.group-transparent')

    if (lockBtn) {
        lockBtn.innerHTML = isLocked ? LOCK_ICON : UNLOCK_ICON
    }
    if (darkBtn) {
        darkBtn.setAttribute('aria-pressed', String(isDark))
    }
    if (shapeBtn) {
        shapeBtn.setAttribute('aria-pressed', String(isGrid))
    }
    if (transparentBtn) {
        transparentBtn.setAttribute('aria-pressed', String(isTransparent))
    }
}

export function bindGroupControls(button: HTMLButtonElement, group: string): void {
    const handle = button.querySelector<HTMLElement>('.group-drag')
    const lockBtn = button.querySelector<HTMLElement>('.group-lock')
    const darkBtn = button.querySelector<HTMLElement>('.group-dark')
    const shapeBtn = button.querySelector<HTMLElement>('.group-shape')
    const transparentBtn = button.querySelector<HTMLElement>('.group-transparent')

    handle?.addEventListener('pointerdown', (event) => {
        event.stopPropagation()
        startGroupDrag(event as PointerEvent, button, group)
    })
    handle?.addEventListener('click', (event) => event.stopPropagation())

    for (const ctrl of [lockBtn, darkBtn, shapeBtn, transparentBtn]) {
        ctrl?.addEventListener('pointerdown', (event) => event.stopPropagation())
    }

    lockBtn?.addEventListener('click', (event) => {
        event.stopPropagation()
        toggleGroupLock(group)
    })

    darkBtn?.addEventListener('click', (event) => {
        event.stopPropagation()
        toggleGroupDark(group)
    })

    shapeBtn?.addEventListener('click', (event) => {
        event.stopPropagation()
        toggleGroupShape(group)
    })

    transparentBtn?.addEventListener('click', (event) => {
        event.stopPropagation()
        toggleGroupTransparent(group)
    })
}

async function toggleGroupShape(group: string): Promise<void> {
    const data = await storage.sync.get()
    const layouts = { ...data.linkgroups.iconsLayouts }

    layouts[group] = (layouts[group] ?? 'row') === 'row' ? 'grid' : 'row'
    data.linkgroups.iconsLayouts = layouts
    storage.sync.set(data)

    const button = findGroupButton(group)
    if (button) {
        applyGroupAppearance(button, group, data)
    }
}

async function toggleGroupLock(group: string): Promise<void> {
    const data = await storage.sync.get()
    const locked = new Set(data.linkgroups.locked ?? [])

    locked.has(group) ? locked.delete(group) : locked.add(group)
    data.linkgroups.locked = [...locked]
    storage.sync.set(data)

    const button = findGroupButton(group)
    if (button) {
        applyGroupAppearance(button, group, data)
    }
}

async function toggleGroupDark(group: string): Promise<void> {
    const data = await storage.sync.get()
    const darkBubbles = new Set(data.linkgroups.darkBubbles ?? [])

    darkBubbles.has(group) ? darkBubbles.delete(group) : darkBubbles.add(group)
    data.linkgroups.darkBubbles = [...darkBubbles]
    storage.sync.set(data)

    const button = findGroupButton(group)
    if (button) {
        applyGroupAppearance(button, group, data)
    }
}

async function toggleGroupTransparent(group: string): Promise<void> {
    const data = await storage.sync.get()
    const transparentBubbles = new Set(data.linkgroups.transparentBubbles ?? [])

    transparentBubbles.has(group) ? transparentBubbles.delete(group) : transparentBubbles.add(group)
    data.linkgroups.transparentBubbles = [...transparentBubbles]
    storage.sync.set(data)

    const button = findGroupButton(group)
    if (button) {
        applyGroupAppearance(button, group, data)
    }
}

function findGroupButton(group: string): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(`.link-title[data-group="${CSS.escape(group)}"]`)
}

function startGroupDrag(event: PointerEvent, button: HTMLButtonElement, group: string): void {
    if (button.classList.contains('position-locked')) {
        return
    }

    event.preventDefault()

    const rect = button.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY

    button.classList.add('dragging-position')
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)

    function move(e: PointerEvent): void {
        const x = ((rect.left + (e.clientX - startX)) / globalThis.innerWidth) * 100
        const y = ((rect.top + (e.clientY - startY)) / globalThis.innerHeight) * 100

        button.classList.add('free-position')
        button.style.setProperty('--pos-x', `${x}%`)
        button.style.setProperty('--pos-y', `${y}%`)
    }

    async function up(): Promise<void> {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        button.classList.remove('dragging-position')

        const x = Number.parseFloat(button.style.getPropertyValue('--pos-x'))
        const y = Number.parseFloat(button.style.getPropertyValue('--pos-y'))

        const data = await storage.sync.get()
        data.linkgroups.positions = { ...data.linkgroups.positions, [group]: { x, y } }
        storage.sync.set(data)
    }
}
