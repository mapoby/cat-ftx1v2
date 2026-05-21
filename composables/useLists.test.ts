// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useLists } from './useLists'

function resetState() {
  const { userLists, bundledLists } = useLists()
  userLists.value = []
  bundledLists.value = []
  localStorage.clear()
}

beforeEach(() => {
  resetState()
})

// ── validateChannelList ───────────────────────────────────────────────────────

describe('validateChannelList', () => {
  it('returns false for null', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList(null)).toBe(false)
  })

  it('returns false for empty object', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({})).toBe(false)
  })

  it('returns true for valid object with empty entries', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({ id: 'x', name: 'y', entries: [] })).toBe(true)
  })

  it('returns false when freq is below 100000', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({ id: 'x', name: 'y', entries: [{ freq: 99999 }] })).toBe(false)
  })

  it('returns false when freq is above 470000000', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({ id: 'x', name: 'y', entries: [{ freq: 470000001 }] })).toBe(false)
  })

  it('returns true when freq is within valid range', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({ id: 'x', name: 'y', entries: [{ freq: 145500000 }] })).toBe(true)
  })

  it('returns false when entries is not an array', () => {
    const { validateChannelList } = useLists()
    expect(validateChannelList({ id: 'x', name: 'y', entries: 'bad' })).toBe(false)
  })
})

// ── CRUD ─────────────────────────────────────────────────────────────────────

describe('CRUD', () => {
  it('createList returns object with source=user, non-empty id, empty entries', () => {
    const { createList } = useLists()
    const list = createList('Test')
    expect(list.source).toBe('user')
    expect(list.id).toBeTruthy()
    expect(list.entries).toEqual([])
    expect(list.name).toBe('Test')
  })

  it('renameList updates name for user-source list', () => {
    const { createList, renameList, userLists } = useLists()
    const list = createList('Original')
    renameList(list.id, 'Updated')
    expect(userLists.value.find(l => l.id === list.id)!.name).toBe('Updated')
  })

  it('deleteList removes user list by id', () => {
    const { createList, deleteList, userLists } = useLists()
    const list = createList('ToDelete')
    deleteList(list.id)
    expect(userLists.value.find(l => l.id === list.id)).toBeUndefined()
  })

  it('deleteList is no-op on bundled list', () => {
    const { bundledLists, deleteList } = useLists()
    bundledLists.value = [{ id: 'bundled-1', name: 'Bundled', source: 'bundled', createdAt: '2026-01-01T00:00:00Z', entries: [] }]
    deleteList('bundled-1')
    expect(bundledLists.value.length).toBe(1)
  })

  it('addEntry pushes entry to user list', () => {
    const { createList, addEntry, userLists } = useLists()
    const list = createList('WithEntry')
    const entry = { freq: 145500000, txFreq: null, splitMem: false, mode: 'FM', sqlType: 0, ctcssIdx: null, dcsIdx: null, shift: 0, tag: '2m CALL' }
    addEntry(list.id, entry)
    expect(userLists.value.find(l => l.id === list.id)!.entries).toHaveLength(1)
  })

  it('removeEntry removes entry by index from user list', () => {
    const { createList, addEntry, removeEntry, userLists } = useLists()
    const list = createList('RemoveTest')
    const entry = { freq: 145500000, txFreq: null, splitMem: false, mode: 'FM', sqlType: 0, ctcssIdx: null, dcsIdx: null, shift: 0, tag: 'TAG' }
    addEntry(list.id, entry)
    removeEntry(list.id, 0)
    expect(userLists.value.find(l => l.id === list.id)!.entries).toHaveLength(0)
  })
})

// ── localStorage round-trip ───────────────────────────────────────────────────

describe('localStorage round-trip', () => {
  it('saveUserLists + loadUserLists restores identical data', () => {
    const { createList, addEntry, saveUserLists, loadUserLists, userLists } = useLists()
    const list = createList('Persist')
    addEntry(list.id, { freq: 14300000, txFreq: null, splitMem: false, mode: 'USB', sqlType: 0, ctcssIdx: null, dcsIdx: null, shift: 0, tag: '20m CALL' })
    saveUserLists()
    const savedId = list.id
    userLists.value = []
    loadUserLists()
    const restored = userLists.value.find(l => l.id === savedId)
    expect(restored).toBeDefined()
    expect(restored!.name).toBe('Persist')
    expect(restored!.entries[0].freq).toBe(14300000)
  })
})

// ── importListFromText ────────────────────────────────────────────────────────

describe('importListFromText', () => {
  it('parses valid JSON and pushes to userLists', () => {
    const { importListFromText, userLists } = useLists()
    const json = JSON.stringify({ id: 'abc', name: 'From File', source: 'bundled', createdAt: '2026-01-01T00:00:00Z', entries: [] })
    importListFromText(json)
    expect(userLists.value.some(l => l.name === 'From File')).toBe(true)
  })

  it('sets source=user regardless of JSON content', () => {
    const { importListFromText, userLists } = useLists()
    const json = JSON.stringify({ id: 'abc', name: 'Bundled Import', source: 'bundled', createdAt: '2026-01-01T00:00:00Z', entries: [] })
    importListFromText(json)
    const imported = userLists.value.find(l => l.name === 'Bundled Import')
    expect(imported!.source).toBe('user')
  })

  it('assigns a new id regardless of JSON content', () => {
    const { importListFromText, userLists } = useLists()
    const json = JSON.stringify({ id: 'original-id', name: 'ID Override', source: 'user', createdAt: '2026-01-01T00:00:00Z', entries: [] })
    importListFromText(json)
    const imported = userLists.value.find(l => l.name === 'ID Override')
    expect(imported!.id).not.toBe('original-id')
  })

  it('throws on invalid JSON', () => {
    const { importListFromText } = useLists()
    expect(() => importListFromText('not json{')).toThrow()
  })
})
