import { getIconFromLinkElem, linksUpdate } from './index.ts'
import { getLinksInGroup, isElem } from './helpers.ts'
import { openContextMenu } from '../contextmenu.ts'
import { initblocks } from './index.ts'
import { startDrag } from './drag.ts'
import { applyGroupAppearance, bindGroupControls, UNLOCK_ICON } from './position.ts'

import { transitioner } from '../../utils/transitioner.ts'
import { tradThis } from '../../utils/translations.ts'
import { storage } from '../../storage.ts'

import type { Sync } from '../../../types/sync.ts'
import type { Local } from '../../../types/local.ts'

const domlinkblocks = document.getElementById('linkblocks') as HTMLDivElement

// Single delegated listener for every group menu, instead of one per bubble:
// bubbles get torn down and recreated by initGroups often, and a per-instance
// listener would either leak (never removed) or need careful teardown.
document.addEventListener('click', (event) => {
    for (const wrapper of document.querySelectorAll<HTMLElement>('.group-controls.expanded')) {
        if (!wrapper.contains(event.target as Node)) {
            wrapper.classList.remove('expanded')
            expandedGroupMenus.delete(wrapper.closest<HTMLElement>('.link-title')?.dataset.group ?? '')
        }
    }
})

function onLinkMiniWheel(event: Event): void {
    changeGroup(event)
    event.preventDefault()
}

export async function initGroups(data: Sync, init?: true): Promise<void> {
    const local = await storage.local.get()

    if (!init) {
        for (const node of document.querySelectorAll('#link-mini button') ?? []) {
            node.remove()
        }
    }

    createGroups(data, local)

    // navigating through groups with scroll wheel
    const linkMini = document.querySelector('#link-mini')
    linkMini?.removeEventListener('wheel', onLinkMiniWheel)
    linkMini?.addEventListener('wheel', onLinkMiniWheel, { passive: false })
}

function createGroups(data: Sync, local: Local): void {
    const { groups, pinned, synced, selected } = data.linkgroups

    for (const group of [...groups, '+']) {
        const button = document.createElement('button')
        const iconsWrapper = document.createElement('span')
        const textSpan = document.createElement('span')
        const isTopSite = group === 'topsites'
        const isDefault = group === 'default'
        const isAddMore = group === '+'

        if (pinned.includes(group)) {
            continue
        }

        iconsWrapper.classList.add('link-title-icons')
        textSpan.classList.add('link-title-text')
        textSpan.textContent = group

        button.dataset.group = group
        button.classList.add('link-title')
        button.classList.toggle('selected-group', group === selected)
        button.classList.toggle('synced', synced.includes(group))

        if (isTopSite) {
            textSpan.textContent = tradThis('Most visited')
            button.classList.add('topsites-title')
        }

        if (isDefault) {
            textSpan.textContent = tradThis('Default group')
        }

        if (isAddMore) {
            button.classList.add('add-group')
            button.addEventListener('click', openContextMenu)
        } else {
            button.addEventListener('click', changeGroup)
            button.addEventListener('pointerdown', startDrag)
            bindExternalBookmarkDrop(button, group)

            for (const link of getLinksInGroup(data, group)) {
                if (isElem(link)) {
                    const url = getIconFromLinkElem(link)
                    const iconWrapper = document.createElement('span')
                    const img = document.createElement('img')
                    const label = document.createElement('span')

                    iconWrapper.classList.add('link-title-icon')
                    iconWrapper.dataset.linkId = link._id
                    img.alt = link.title ?? ''
                    img.title = link.title || link.url
                    img.draggable = false
                    img.loading = 'lazy'
                    img.src = url.startsWith('link') ? (local[`x-icon-${url}`] ?? '') : url
                    img.addEventListener('pointerdown', (event) => {
                        event.stopPropagation()

                        if ((event as PointerEvent).button > 0) {
                            return
                        }

                        startFavoriteDrag(event as PointerEvent, iconWrapper, link._id, group)
                    })
                    img.addEventListener('click', (event) => {
                        event.stopPropagation()
                        globalThis.open(link.url, data.linknewtab ? '_blank' : '_self')
                    })

                    label.classList.add('link-title-icon-name')
                    label.textContent = link.title || link.url

                    iconWrapper.append(img, label)
                    iconsWrapper.appendChild(iconWrapper)
                }
            }

            button.appendChild(createGroupControls(group))
        }

        button.appendChild(iconsWrapper)
        button.appendChild(textSpan)

        document.querySelector('#link-mini div')?.appendChild(button)

        if (!isAddMore) {
            applyGroupAppearance(button, group, data)
            bindGroupControls(button, group)
        }
    }

    domlinkblocks?.classList.toggle('with-groups', data.linkgroups.on)
}

const DRAG_ICON =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>'

const MOON_ICON =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em"><path d="M13 9.8A5.6 5.6 0 1 1 6.2 3a4.4 4.4 0 0 0 6.8 6.8z"/></svg>'

const GRID_ICON =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>'

const TRANSPARENT_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" width="1em" height="1em"><rect x="2" y="2" width="12" height="12" rx="2" stroke-dasharray="2.2 1.8"/></svg>'

const EDIT_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" width="1em" height="1em"><path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-3 1 1-3z"/></svg>'

const TRASH_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" width="1em" height="1em"><path d="M3 4h10M6.5 4V2.8a.8.8 0 0 1 .8-.8h1.4a.8.8 0 0 1 .8.8V4M4.5 4l.6 9a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-9"/></svg>'

const MORE_ICON =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>'

// Renaming or deleting "topsites" would break logic elsewhere that keys
// off that literal name (it's a virtual, browser-generated group, not one
// the user actually owns links in).
const RESERVED_GROUPS = new Set(['topsites'])

// Which group menus are expanded, kept in memory only (not synced): bubbles
// get torn down and recreated by initGroups on almost every action, and
// re-collapsing the menu each time would undo whatever the user just opened
// it for. Resets on page reload, unlike the rest of the group appearance
// state, which is intentional here (a stale "always open" menu isn't wanted).
const expandedGroupMenus = new Set<string>()

function createGroupControls(group: string): HTMLSpanElement {
    const wrapper = document.createElement('span')
    wrapper.classList.add('group-controls')
    wrapper.classList.toggle('expanded', expandedGroupMenus.has(group))

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.classList.add('group-menu-toggle')
    toggle.title = tradThis('Group options')
    toggle.setAttribute('aria-label', tradThis('Open group options'))
    toggle.innerHTML = MORE_ICON

    const actions = document.createElement('span')
    actions.classList.add('group-controls-actions')

    const drag = document.createElement('button')
    drag.type = 'button'
    drag.classList.add('group-drag')
    drag.title = tradThis('Drag to reposition')
    drag.setAttribute('aria-label', tradThis('Drag to reposition group'))
    drag.innerHTML = DRAG_ICON

    const lock = document.createElement('button')
    lock.type = 'button'
    lock.classList.add('group-lock')
    lock.title = tradThis('Lock position')
    lock.setAttribute('aria-label', tradThis('Lock group position'))
    lock.innerHTML = UNLOCK_ICON

    const dark = document.createElement('button')
    dark.type = 'button'
    dark.classList.add('group-dark')
    dark.title = tradThis('Toggle dark bubble')
    dark.setAttribute('aria-label', tradThis('Toggle dark bubble theme'))
    dark.innerHTML = MOON_ICON

    const shape = document.createElement('button')
    shape.type = 'button'
    shape.classList.add('group-shape')
    shape.title = tradThis('Change icons layout')
    shape.setAttribute('aria-label', tradThis('Change group icons layout'))
    shape.innerHTML = GRID_ICON

    const transparent = document.createElement('button')
    transparent.type = 'button'
    transparent.classList.add('group-transparent')
    transparent.title = tradThis('Toggle transparent icons')
    transparent.setAttribute('aria-label', tradThis('Toggle transparent favicon background'))
    transparent.innerHTML = TRANSPARENT_ICON

    actions.append(lock, dark, shape, transparent)

    if (!RESERVED_GROUPS.has(group)) {
        const rename = document.createElement('button')
        rename.type = 'button'
        rename.classList.add('group-rename')
        rename.title = tradThis('Rename group')
        rename.setAttribute('aria-label', tradThis('Rename group'))
        rename.innerHTML = EDIT_ICON

        const del = document.createElement('button')
        del.type = 'button'
        del.classList.add('group-delete')
        del.title = tradThis('Delete group')
        del.setAttribute('aria-label', tradThis('Delete group'))
        del.innerHTML = TRASH_ICON

        actions.append(rename, del)
    }

    toggle.addEventListener('pointerdown', (event) => event.stopPropagation())
    toggle.addEventListener('click', (event) => {
        event.stopPropagation()
        const isOpen = wrapper.classList.toggle('expanded')

        if (isOpen) {
            // only one group menu open at a time
            for (const other of document.querySelectorAll<HTMLElement>('.group-controls.expanded')) {
                if (other !== wrapper) {
                    other.classList.remove('expanded')
                    expandedGroupMenus.delete(other.closest<HTMLElement>('.link-title')?.dataset.group ?? '')
                }
            }

            expandedGroupMenus.add(group)
        } else {
            expandedGroupMenus.delete(group)
        }
    })

    wrapper.append(drag, toggle, actions)

    return wrapper
}

function changeGroup(event: Event): void {
    let button: HTMLButtonElement

    if (event.type === 'wheel') {
        // all the selectable group buttons
        const buttons = Array.from(
            document.querySelectorAll<HTMLButtonElement>('.link-title:not(.add-group)[data-group]'),
        )

        // gets the index of the currently selected group
        const index = buttons.findIndex((btn) => btn.classList.contains('selected-group'))

        button = buttons[
            // unsmooth brain thing to get the index for the previous/next button
            (index + ((event as WheelEvent).deltaY > 0 ? 1 : -1) + buttons.length) % buttons.length
        ]
    } else { // click event (probably)
        button = event.currentTarget as HTMLButtonElement
    }

    const transition = transitioner()

    if (!!domlinkblocks.dataset.folderid || button.classList.contains('selected-group')) {
        return
    }

    transition.first(hideCurrentGroup)
    transition.after(recreateLinksFromNewGroup)
    transition.finally(showNewGroup)
    transition.transition(100)

    async function recreateLinksFromNewGroup(): Promise<void> {
        const buttons = document.querySelectorAll<HTMLElement>('#link-mini button')
        const data = await storage.sync.get()
        const group = button.dataset.group ?? data.linkgroups.groups[0]

        for (const div of buttons ?? []) {
            div.classList.remove('selected-group')
        }
        button.classList.add('selected-group')
        data.linkgroups.selected = group
        storage.sync.set(data)
        initblocks(data)
    }

    function hideCurrentGroup(): void {
        domlinkblocks.classList.remove('in-folder')
        domlinkblocks.classList.add('hiding')
    }

    function showNewGroup(): void {
        domlinkblocks.classList.remove('hiding')
    }
}

// Updates

export function toggleGroups(on: boolean, data: Sync): Sync {
    domlinkblocks?.classList.toggle('with-groups', on)
    data.linkgroups.on = on
    return data
}

export function changeGroupTitle(title: { old: string; new: string }, data: Sync): Sync {
    const index = data.linkgroups.groups.indexOf(title.old)

    for (const link of getLinksInGroup(data, title.old)) {
        data[link._id] = {
            ...link,
            parent: title.new,
        }
    }

    data.linkgroups.groups[index] = title.new
    data.linkgroups.selected = title.new
    renameGroupAppearanceState(data, title.old, title.new)
    initGroups(data)
    return data
}

// Per-group appearance state (position, lock, dark/transparent bubble, icons
// layout) is keyed by group name, so it has to follow renames and be cleaned
// up on delete or it silently desyncs from the group it was set for.

function renameGroupAppearanceState(data: Sync, oldName: string, newName: string): void {
    const { positions, locked, darkBubbles, transparentBubbles, iconsLayouts } = data.linkgroups

    if (positions && oldName in positions) {
        const { [oldName]: value, ...rest } = positions
        data.linkgroups.positions = { ...rest, [newName]: value }
    }
    if (iconsLayouts && oldName in iconsLayouts) {
        const { [oldName]: value, ...rest } = iconsLayouts
        data.linkgroups.iconsLayouts = { ...rest, [newName]: value }
    }
    if (locked?.includes(oldName)) {
        data.linkgroups.locked = [...locked.filter((g) => g !== oldName), newName]
    }
    if (darkBubbles?.includes(oldName)) {
        data.linkgroups.darkBubbles = [...darkBubbles.filter((g) => g !== oldName), newName]
    }
    if (transparentBubbles?.includes(oldName)) {
        data.linkgroups.transparentBubbles = [...transparentBubbles.filter((g) => g !== oldName), newName]
    }
}

function deleteGroupAppearanceState(data: Sync, group: string): void {
    const { positions, iconsLayouts, locked, darkBubbles, transparentBubbles } = data.linkgroups

    if (positions && group in positions) {
        const { [group]: _removed, ...rest } = positions
        data.linkgroups.positions = rest
    }
    if (iconsLayouts && group in iconsLayouts) {
        const { [group]: _removed, ...rest } = iconsLayouts
        data.linkgroups.iconsLayouts = rest
    }
    if (locked) {
        data.linkgroups.locked = locked.filter((g) => g !== group)
    }
    if (darkBubbles) {
        data.linkgroups.darkBubbles = darkBubbles.filter((g) => g !== group)
    }
    if (transparentBubbles) {
        data.linkgroups.transparentBubbles = transparentBubbles.filter((g) => g !== group)
    }
}

export function addGroup(groups: { title: string; sync?: boolean }[], data: Sync): Sync {
    for (const { title, sync } of groups) {
        const isReserved = title === 'default' || title === '+'
        const isAlreadyUsed = data.linkgroups.groups.includes(title)

        if (isReserved || isAlreadyUsed) {
            return data
        }

        for (const link of getLinksInGroup(data, '+')) {
            data[link._id] = {
                ...link,
                parent: title,
            }
        }

        data.linkgroups.selected = title
        data.linkgroups.groups.push(title)

        if (sync) {
            data.linkgroups.synced.push(title)
        }
    }

    initGroups(data)
    initblocks(data)
    return data
}

export function deleteGroup(group: string, data: Sync): Sync {
    const { groups, pinned, synced, selected } = data.linkgroups

    const isBroken = groups.indexOf(group) === -1
    const isMinimum = groups.length === 1

    if (isMinimum || isBroken) {
        return data
    }

    for (const link of getLinksInGroup(data, group)) {
        delete data[link._id]
    }

    data.linkgroups.selected = group === selected || pinned.includes(group) ? groups[0] : selected
    data.linkgroups.pinned = pinned.filter((p) => p !== group)
    data.linkgroups.synced = synced.filter((g) => g !== group)
    data.linkgroups.groups = groups.filter((g) => g !== group)
    deleteGroupAppearanceState(data, group)

    if (groups.length === 2) {
        data.linkgroups.pinned = []
    }

    storage.sync.clear()
    initblocks(data)
    initGroups(data)
    return data
}

export function moveGroups(mini: string[], data: Sync): Sync {
    const userMini = mini.filter((name) => name !== '+')

    data.linkgroups.groups = data.linkgroups.pinned.concat(userMini)
    initGroups(data)

    return data
}

export async function togglePinGroup(group: string, action: 'pin' | 'unpin'): Promise<void> {
    const data = await storage.sync.get()
    const { groups, pinned } = data.linkgroups

    if (action === 'pin') {
        data.linkgroups.pinned.push(group)
    }
    if (action === 'unpin') {
        data.linkgroups.pinned = pinned.filter((pinned) => pinned !== group)
    }

    if (group === data.linkgroups.selected) {
        const unpinned = groups.filter((id) => pinned.includes(id) === false)
        data.linkgroups.selected = unpinned[0]
    }

    storage.sync.set(data)

    initblocks(data)
    initGroups(data)
}

// Dragging a favicon out of its group bubble and onto another one moves the
// link to that group (small self-contained drag, separate from drag.ts's
// li/button based system which doesn't apply to these icons).

function startFavoriteDrag(event: PointerEvent, iconWrapper: HTMLElement, linkId: string, group: string): void {
    const startX = event.clientX
    const startY = event.clientY
    const precision = event.pointerType === 'touch' ? 10 : 6
    const iconsWrapper = iconWrapper.parentElement as HTMLElement

    let dragging = false
    let currentTarget: HTMLButtonElement | null = null
    let reorderTarget: HTMLElement | null = null
    let reorderBefore = true

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)

    function move(e: PointerEvent): void {
        if (!dragging) {
            if (Math.abs(e.clientX - startX) < precision && Math.abs(e.clientY - startY) < precision) {
                return
            }
            dragging = true
            iconWrapper.classList.add('dragging-favorite')
        }

        reorderTarget?.classList.remove('reorder-before', 'reorder-after')
        reorderTarget = null

        for (const sibling of iconsWrapper.querySelectorAll<HTMLElement>('.link-title-icon')) {
            if (sibling === iconWrapper) {
                continue
            }

            const rect = sibling.getBoundingClientRect()
            const isOver = e.clientX >= rect.left && e.clientX <= rect.right
                && e.clientY >= rect.top && e.clientY <= rect.bottom

            if (isOver) {
                reorderTarget = sibling
                reorderBefore = e.clientX < rect.left + rect.width / 2
                reorderTarget.classList.add(reorderBefore ? 'reorder-before' : 'reorder-after')
                break
            }
        }

        currentTarget?.classList.remove('drop-target')
        currentTarget = null

        // only look for a different bubble to drop into when not reordering
        // within the current one
        if (!reorderTarget) {
            const sourceButton = iconWrapper.closest<HTMLButtonElement>('.link-title[data-group]')
            const groupButtons = document.querySelectorAll<HTMLButtonElement>(
                '.link-title[data-group]:not(.add-group)',
            )

            for (const groupButton of groupButtons) {
                if (groupButton === sourceButton) {
                    continue
                }

                const rect = groupButton.getBoundingClientRect()
                const isOver = e.clientX >= rect.left && e.clientX <= rect.right
                    && e.clientY >= rect.top && e.clientY <= rect.bottom

                if (isOver) {
                    currentTarget = groupButton
                    currentTarget.classList.add('drop-target')
                    break
                }
            }
        }
    }

    async function up(): Promise<void> {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)

        iconWrapper.classList.remove('dragging-favorite')
        currentTarget?.classList.remove('drop-target')
        reorderTarget?.classList.remove('reorder-before', 'reorder-after')

        const target = currentTarget?.dataset.group
        const targetId = reorderTarget?.dataset.linkId ?? ''

        if (reorderTarget && targetId) {
            // built from stored links, not the DOM icons: the bubble only
            // renders elem links, so a DOM-derived list would silently drop
            // any folder in the group and scramble its order value
            const data = await storage.sync.get()
            const ids = getLinksInGroup(data, group).map((l) => l._id).filter((id) => id !== linkId)
            const targetIndex = ids.indexOf(targetId)

            if (targetIndex !== -1) {
                ids.splice(reorderBefore ? targetIndex : targetIndex + 1, 0, linkId)
                linksUpdate({ moveLinks: ids })
            }
        } else if (target) {
            linksUpdate({ moveToGroup: { ids: [linkId], target } })
        }

        if (dragging) {
            // suppress the click that follows this pointerup so a drag
            // (successful or not) doesn't also open the link underneath
            iconWrapper.addEventListener('click', suppressClick, { capture: true, once: true })
        }
    }

    function suppressClick(e: MouseEvent): void {
        e.stopPropagation()
        e.preventDefault()
    }
}

// Lets a bookmark dragged from the browser's own bookmarks bar (native HTML5
// drag, not our pointer-based one) be dropped straight onto a group bubble
// to get added as a new link there.

function bindExternalBookmarkDrop(button: HTMLButtonElement, group: string): void {
    button.addEventListener('dragenter', (event) => {
        if (isBookmarkDrag(event)) {
            event.preventDefault()
            button.classList.add('drop-target', 'drop-target-external')
        }
    })

    button.addEventListener('dragover', (event) => {
        if (isBookmarkDrag(event)) {
            event.preventDefault()
        }
    })

    button.addEventListener('dragleave', (event) => {
        if (!button.contains(event.relatedTarget as Node)) {
            button.classList.remove('drop-target', 'drop-target-external')
        }
    })

    button.addEventListener('drop', (event) => {
        button.classList.remove('drop-target', 'drop-target-external')

        if (!isBookmarkDrag(event)) {
            return
        }

        event.preventDefault()

        const { url, title } = getBookmarkFromDrag(event)

        if (url) {
            linksUpdate({ addLinks: [{ title: title || url, url, group }] })
        }
    })
}

function isBookmarkDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('text/uri-list')
}

function getBookmarkFromDrag(event: DragEvent): { url: string; title: string } {
    const dataTransfer = event.dataTransfer
    const url = dataTransfer?.getData('text/uri-list') || dataTransfer?.getData('text/plain') || ''
    const html = dataTransfer?.getData('text/html') ?? ''
    const titleMatch = html.match(/<a[^>]*>([^<]*)<\/a>/i)
    const rawTitle = decodeHtmlEntities(titleMatch?.[1]?.trim() ?? '')

    return { url, title: capitalizeFirst(rawTitle || hostnameFromUrl(url)) }
}

function decodeHtmlEntities(text: string): string {
    if (!text.includes('&')) {
        return text
    }

    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
}

function hostnameFromUrl(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

function capitalizeFirst(text: string): string {
    return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text
}
