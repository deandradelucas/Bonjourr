import { getIconFromLinkElem } from './index.ts'
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

export async function initGroups(data: Sync, init?: true): Promise<void> {
    const local = await storage.local.get()

    if (!init) {
        for (const node of document.querySelectorAll('#link-mini button') ?? []) {
            node.remove()
        }
    }

    createGroups(data, local)

    // navigating through groups with scroll wheel
    document.querySelector('#link-mini')?.addEventListener('wheel', (event) => {
        changeGroup(event)
        event.preventDefault()
    }, { passive: false })
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

            for (const link of getLinksInGroup(data, group)) {
                if (isElem(link)) {
                    const url = getIconFromLinkElem(link)
                    const img = document.createElement('img')
                    img.alt = link.title ?? ''
                    img.title = link.title || link.url
                    img.draggable = false
                    img.loading = 'lazy'
                    img.src = url.startsWith('link') ? (local[`x-icon-${url}`] ?? '') : url
                    img.addEventListener('pointerdown', (event) => event.stopPropagation())
                    img.addEventListener('click', (event) => {
                        event.stopPropagation()
                        globalThis.open(link.url, data.linknewtab ? '_blank' : '_self')
                    })
                    iconsWrapper.appendChild(img)
                }
            }

            button.appendChild(createGroupControls())
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

function createGroupControls(): HTMLSpanElement {
    const wrapper = document.createElement('span')
    wrapper.classList.add('group-controls')

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

    wrapper.append(drag, lock, dark, shape, transparent)

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
    initGroups(data)
    return data
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
