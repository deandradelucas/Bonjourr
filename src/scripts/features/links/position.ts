import { storage } from '../../storage.ts'
import { linksUpdate } from './index.ts'
import { tradThis } from '../../utils/translations.ts'

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
    const renameBtn = button.querySelector<HTMLElement>('.group-rename')
    const deleteBtn = button.querySelector<HTMLElement>('.group-delete')

    handle?.addEventListener('pointerdown', (event) => {
        event.stopPropagation()
        startGroupDrag(event as PointerEvent, button, group)
    })
    handle?.addEventListener('click', (event) => event.stopPropagation())

    for (const ctrl of [lockBtn, darkBtn, shapeBtn, transparentBtn, renameBtn, deleteBtn]) {
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

    renameBtn?.addEventListener('click', (event) => {
        event.stopPropagation()
        startGroupRename(button, group)
    })

    deleteBtn?.addEventListener('click', (event) => {
        event.stopPropagation()

        if (globalThis.confirm(tradThis('Delete this group and all its links?'))) {
            linksUpdate({ deleteGroup: group })
        }
    })
}

function startGroupRename(button: HTMLButtonElement, group: string): void {
    const textSpan = button.querySelector<HTMLSpanElement>('.link-title-text')

    if (!textSpan || textSpan.isContentEditable) {
        return
    }

    textSpan.contentEditable = 'true'
    textSpan.spellcheck = false
    textSpan.focus()
    document.execCommand('selectAll', false)

    const controller = new AbortController()
    const { signal } = controller

    textSpan.addEventListener('pointerdown', (event) => event.stopPropagation(), { signal })
    textSpan.addEventListener('click', (event) => event.stopPropagation(), { signal })

    textSpan.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            textSpan.blur()
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            textSpan.textContent = group
            textSpan.blur()
        }
    }, { signal })

    textSpan.addEventListener('blur', commit, { signal })

    function commit(): void {
        controller.abort()
        textSpan.contentEditable = 'false'

        const newTitle = textSpan.textContent?.trim() ?? ''

        if (newTitle && newTitle !== group) {
            linksUpdate({ groupTitle: { old: group, new: newTitle } })
        } else {
            textSpan.textContent = group
        }
    }
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

function getPositionContainerRect(): DOMRect {
    const container = document.getElementById('interface')
    return container?.getBoundingClientRect() ?? new DOMRect(0, 0, globalThis.innerWidth, globalThis.innerHeight)
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
        // percentages relative to #interface (the bubble's positioned
        // ancestor), not the viewport: the settings panel toggles a
        // transform on #interface, which only moves elements whose
        // coordinates are already relative to it. Using window size here
        // would make the bubble jump the instant that transform appears.
        const containerRect = getPositionContainerRect()
        const x = ((rect.left + (e.clientX - startX) - containerRect.left) / containerRect.width) * 100
        const y = ((rect.top + (e.clientY - startY) - containerRect.top) / containerRect.height) * 100

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
