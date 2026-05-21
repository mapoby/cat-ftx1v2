import { ref, computed } from 'vue'

export interface ListEntry {
  freq: number
  txFreq: number | null
  splitMem: boolean
  mode: string | null
  sqlType: number | null
  ctcssIdx: number | null
  dcsIdx: number | null
  shift: number | null
  tag: string | null
}

export interface ChannelList {
  id: string
  name: string
  description?: string
  source: 'bundled' | 'user' | 'remote'
  url?: string
  createdAt: string
  entries: ListEntry[]
}

const LS_KEY = 'cat_lists_v1'

const userLists    = ref<ChannelList[]>([])
const bundledLists = ref<ChannelList[]>([])
const loadError    = ref<string | null>(null)

const allLists = computed(() => [...bundledLists.value, ...userLists.value])

function validateChannelList(obj: unknown): obj is ChannelList {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o['id'] !== 'string') return false
  if (typeof o['name'] !== 'string') return false
  if (!Array.isArray(o['entries'])) return false
  for (const e of o['entries'] as unknown[]) {
    const entry = e as Record<string, unknown>
    if (typeof entry['freq'] !== 'number') return false
    if ((entry['freq'] as number) < 100_000) return false
    if ((entry['freq'] as number) > 470_000_000) return false
  }
  return true
}

function saveUserLists(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(userLists.value))
  } catch { /* quota exceeded — silent */ }
}

function loadUserLists(): void {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw === null) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    userLists.value = parsed.filter((entry: unknown) => validateChannelList(entry))
  } catch { /* corrupt — discard */ }
}

async function initLists(): Promise<void> {
  loadUserLists()
  try {
    const res = await fetch('/lists/index.json')
    if (!res.ok) {
      console.warn('[useLists] index.json fetch failed:', res.status)
      return
    }
    const filenames: string[] = await res.json()
    const results = await Promise.allSettled(
      filenames.map(async (filename: string) => {
        try {
          const r = await fetch('/lists/' + filename)
          if (!r.ok) { console.warn('[useLists] failed to load', filename, r.status); return }
          const data: unknown = await r.json()
          if (validateChannelList(data)) {
            bundledLists.value.push(data)
          } else {
            console.warn('[useLists] invalid ChannelList in', filename)
          }
        } catch (e) {
          console.warn('[useLists] error loading', filename, e)
        }
      })
    )
    void results
  } catch (e) {
    console.warn('[useLists] failed to fetch index.json', e)
  }
}

function createList(name: string): ChannelList {
  const list: ChannelList = {
    id: crypto.randomUUID(),
    name,
    source: 'user',
    createdAt: new Date().toISOString(),
    entries: [],
  }
  userLists.value.push(list)
  saveUserLists()
  return list
}

function renameList(id: string, newName: string): void {
  const list = userLists.value.find(l => l.id === id)
  if (!list || list.source !== 'user') return
  list.name = newName
  saveUserLists()
}

function deleteList(id: string): void {
  const idx = userLists.value.findIndex(l => l.id === id)
  if (idx === -1) return
  if (userLists.value[idx].source !== 'user') return
  userLists.value.splice(idx, 1)
  saveUserLists()
}

function addEntry(listId: string, entry: ListEntry): void {
  const list = userLists.value.find(l => l.id === listId)
  if (!list || list.source !== 'user') return
  list.entries.push(entry)
  saveUserLists()
}

function updateEntry(listId: string, index: number, entry: ListEntry): void {
  const list = userLists.value.find(l => l.id === listId)
  if (!list) return
  list.entries[index] = entry
  saveUserLists()
}

function removeEntry(listId: string, index: number): void {
  const list = userLists.value.find(l => l.id === listId)
  if (!list) return
  list.entries.splice(index, 1)
  saveUserLists()
}

async function fetchRemoteList(url: string): Promise<ChannelList> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Could not fetch — check the URL is correct and the server allows cross-origin requests.')
  }
  if (!res.ok) {
    throw new Error('Server returned ' + res.status)
  }
  const data: unknown = await res.json()
  if (!validateChannelList(data)) {
    throw new Error('Response is not a valid ChannelList')
  }
  data.source = 'remote'
  data.url = url
  userLists.value.push(data)
  saveUserLists()
  return data
}

function exportList(list: ChannelList): void {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = list.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importListFromText(text: string): ChannelList {
  const data: unknown = JSON.parse(text)
  if (!validateChannelList(data)) {
    throw new Error('Invalid ChannelList JSON')
  }
  data.id = crypto.randomUUID()
  data.source = 'user'
  userLists.value.push(data)
  saveUserLists()
  return data
}

export function useLists() {
  return {
    allLists,
    userLists,
    bundledLists,
    loadError,
    initLists,
    loadUserLists,
    saveUserLists,
    createList,
    renameList,
    deleteList,
    addEntry,
    updateEntry,
    removeEntry,
    fetchRemoteList,
    validateChannelList,
    exportList,
    importListFromText,
  }
}
