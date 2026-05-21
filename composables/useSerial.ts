// Browser-side CAT controller using the Web Serial API.
// Replaces the Node.js serial-server.mjs — no backend required.
// State is fully reactive; components subscribe via useSerial().state.

import { shallowRef, ref } from 'vue'
import { parseResponse, MODE_CODE } from './catParser'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TransceiverState {
  connected: boolean
  port: string | null
  baudRate: number
  autoInfo: boolean
  mainFreq: number | null
  subFreq: number | null
  mainMode: string | null
  subMode: string | null
  mainSmeter: number | null
  subSmeter: number | null
  txState: boolean
  mox: boolean
  split: boolean
  lock: boolean | null
  agcMain: string | null
  rfGainMain: number | null
  afGainMain: number | null
  sqMain: number | null
  agcSub: string | null
  rfGainSub: number | null
  afGainSub: number | null
  sqSub: number | null
  sqlRfMode: number | null
  powerLevel: number | null
  radioInfo: {
    hiSwr: boolean; recording: boolean; playing: boolean
    tx: boolean; txInhibit: boolean; tuning: boolean; scanning: boolean; squelchOpen: boolean
  } | null
  amcLevel: number | null
  micGain: number | null
  speechProc: boolean | null
  speechProcLevel: number | null
  funcKnob: string | null
  vox: boolean | null
  voxGain: number | null
  txVfo: 0 | 1 | null
  rxMode: 'dual' | 'single' | null
  mainSqlType: number | null
  subSqlType: number | null
  mainCtcssTone: number | null
  subCtcssTone: number | null
  mainDcsCode: number | null
  subDcsCode: number | null
  dnrMain: number | string | null
  dnrSub: number | string | null
  mainBandwidth: number | null
  subBandwidth: number | null
  mainShift: number | null
  subShift: number | null
  narrowMain: number | null
  narrowSub: number | null
  rfAttenuator: boolean
  preAmpHf: number | null
  preAmpVhf: boolean | null
  preAmpUhf: boolean | null
  scopeSide: number | null
  scope: {
    mode: number | null; span: number | null; speed: number | null
    level: number | null; att: number | null; color: number | null; marker: boolean | null
  } | null
  firmware: {
    main: string | null; display: string | null; sdr: string | null
    dsp: string | null; spa1: string | null; fc80: string | null
  }
  antSelect: number | null
  radioChannels: Record<number, RadioChannel>
  lastUpdate: number
  error: string | null
}

export interface CommandResult {
  command: string
  response?: string
  error?: string
  ok: boolean
}

export interface RadioChannel {
  slot: number
  freq: number          // RX frequency Hz
  txFreq: number | null // TX frequency Hz (from MZ); null = same as RX
  splitMem: boolean     // split memory enabled (MZ P2)
  mode: string | null
  sqlType: number | null
  clarDir: string | null  // '+' or '-'
  clarOffset: number | null // Hz
  rxClar: boolean
  txClar: boolean
  shift: number         // 0=simplex 1=plus 2=minus
  tag: string | null
  ctcssIdx: number | null
  dcsIdx: number | null
}

export interface MemoryWriteConfig {
  freq: number
  txFreq?: number | null
  splitMem?: boolean
  mode: string | null
  sqlType?: number | null
  ctcssIdx?: number | null
  dcsIdx?: number | null
  clarDir?: string | null
  clarOffset?: number | null
  rxClar?: boolean
  txClar?: boolean
  shift?: number | null
  tag?: string | null
}

export function defaultState(): TransceiverState {
  return {
    connected: false, port: null, baudRate: 38400, autoInfo: false,
    mainFreq: null, subFreq: null, mainMode: null, subMode: null,
    mainSmeter: null, subSmeter: null,
    txState: false, mox: false, split: false, lock: null,
    agcMain: null, rfGainMain: null, afGainMain: null, sqMain: null,
    agcSub: null,  rfGainSub: null, afGainSub: null,  sqSub: null,
    sqlRfMode: null, powerLevel: null, radioInfo: null,
    amcLevel: null, micGain: null,
    speechProc: null, speechProcLevel: null, funcKnob: null,
    vox: null, voxGain: null,
    txVfo: null, rxMode: null,
    mainSqlType: null, subSqlType: null,
    mainCtcssTone: null, subCtcssTone: null,
    mainDcsCode: null, subDcsCode: null,
    dnrMain: null, dnrSub: null,
    mainBandwidth: null, subBandwidth: null,
    mainShift: null, subShift: null,
    narrowMain: null, narrowSub: null,
    rfAttenuator: false,
    preAmpHf: null, preAmpVhf: null, preAmpUhf: null,
    scopeSide: null, scope: null,
    firmware: { main: null, display: null, sdr: null, dsp: null, spa1: null, fc80: null },
    antSelect: null,
    radioChannels: {},
    lastUpdate: Date.now(), error: null,
  }
}

// ── Singleton state (module-level — shared across all useSerial() calls) ─────

export const state = shallowRef<TransceiverState>(defaultState())
export const connecting = ref(false)
export const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator

interface QueueEntry {
  cmd: string
  resolve: (response: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let _port: SerialPort | null = null
let _writer: WritableStreamDefaultWriter<Uint8Array> | null = null
let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null
const _queue: QueueEntry[] = []
const _enc = new TextEncoder()

function _patch(changes: Partial<TransceiverState>) {
  state.value = { ...state.value, ...changes, lastUpdate: Date.now() }
}

// ── Low-level write ──────────────────────────────────────────────────────────

async function _write(cmd: string): Promise<void> {
  if (!_writer) throw new Error('Not connected')
  await _writer.write(_enc.encode(cmd + ';'))
}

// ── Read loop — runs for the lifetime of the connection ──────────────────────

async function _startReadLoop(port: SerialPort): Promise<void> {
  _reader = port.readable.getReader()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await _reader.read()
      if (done) break
      buffer += new TextDecoder().decode(value)
      const parts = buffer.split(';')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const t = part.trim()
        if (t.length >= 2) _handleResponse(t)
      }
    }
  } catch {
    // port cancelled or errored — normal on disconnect
  } finally {
    try { _reader.releaseLock() } catch { /* ignore */ }
    _reader = null
  }
  if (state.value.connected) {
    _patch({ connected: false, autoInfo: false, port: null, error: 'Port closed' })
  }
}

// ── Response dispatcher (solicited + unsolicited AI frames) ──────────────────

function _handleResponse(response: string): void {
  if (response === '?') {
    const e = _queue.shift()
    if (e) { clearTimeout(e.timer); e.reject(new Error(`Radio rejected command: ${e.cmd}`)) }
    return
  }

  const prefix = response.substring(0, 2).toUpperCase()

  // Solicited: head of queue expects this prefix → resolve it
  if (_queue.length > 0 && _queue[0].cmd.substring(0, 2).toUpperCase() === prefix) {
    const e = _queue.shift()!
    clearTimeout(e.timer)
    const delta = parseResponse(prefix, response.substring(2), state.value, e.cmd)
    _patch(delta)
    if (delta.scopeSide != null) _fireScopeRequery(delta.scopeSide)
    e.resolve(response)
    return
  }

  // Unsolicited AI frame
  const delta = parseResponse(prefix, response.substring(2), state.value)
  _patch(delta)
  if (delta.scopeSide != null) _fireScopeRequery(delta.scopeSide)
}

function _fireScopeRequery(side: number): void {
  ;(async () => {
    for (const c of [`SS${side}5`, `SS${side}4`, `SS${side}0`, `SS${side}3`, `SS${side}6`]) {
      if (!_port) break
      try { await _write(c) } catch { }
      await new Promise(r => setTimeout(r, 40))
    }
  })()
}

// ── Command queue: send and wait for response ────────────────────────────────

export function sendAndWait(cmd: string, timeoutMs = 1500): Promise<string> {
  return _sendAndWait(cmd, timeoutMs)
}

function _sendAndWait(cmd: string, timeoutMs = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = _queue.findIndex(e => e === entry)
      if (idx >= 0) _queue.splice(idx, 1)
      reject(new Error(`Radio did not respond to: ${cmd}`))
    }, timeoutMs)
    const entry: QueueEntry = { cmd, resolve, reject, timer }
    _queue.push(entry)
    _write(cmd).catch(err => {
      clearTimeout(timer)
      const idx = _queue.findIndex(e => e === entry)
      if (idx >= 0) _queue.splice(idx, 1)
      reject(err)
    })
  })
}

function _drainQueue(err: Error): void {
  const q = _queue.splice(0)
  for (const e of q) { clearTimeout(e.timer); e.reject(err) }
}

function _wireSerialEvents(): void {
  ;(navigator as any).serial.addEventListener('disconnect', _handlePhysicalDisconnect)
}

function _unwireSerialEvents(): void {
  ;(navigator as any).serial.removeEventListener('disconnect', _handlePhysicalDisconnect)
}

function _handlePhysicalDisconnect(event: Event): void {
  if ((event as any).target !== _port) return
  _unwireSerialEvents()
  _drainQueue(new Error('Serial port disconnected'))
  if (_reader) { try { _reader.cancel() } catch { } _reader = null }
  if (_writer) { try { _writer.releaseLock() } catch { } _writer = null }
  _port = null
  state.value = defaultState()
}

// ── Init sequences ───────────────────────────────────────────────────────────

async function _enableAutoInfo(): Promise<void> {
  try { await _sendAndWait('AI1', 1000) } catch { /* ignore */ }
  try {
    await _sendAndWait('AI', 1000)
    _patch({ autoInfo: true })
  } catch {
    _patch({ autoInfo: false })
  }
}

// Must only be called after _enableAutoInfo() has completed — these are query
// commands whose responses arrive as unsolicited AI frames. Calling before AI
// mode is confirmed active will silently lose the responses.
async function _initialSync(): Promise<void> {
  for (const cmd of ['FA','FB','MD0','MD1','TX','ST','GT0','GT1','AG0','AG1','RG0','RG1','PC','RI0','FR','FT','SS04']) {
    if (!_port) break
    try { await _write(cmd) } catch { /* non-fatal */ }
    await new Promise(r => setTimeout(r, 40))
  }
}

async function _initialSync2(): Promise<void> {
  for (const cmd of [
    'NA0','NA1','AO','MG','PR0','PR1','PL','VX','VG','SF','CT0','CT1',
    'CN00','CN01','CN10','CN11','RL0','RL1','RA0','LK','SQ0','SQ1',
    'SS05','SS00','SS03','SS06','PA0','PA1','PA2',
    'VE0','VE1','VE2','VE3','VE4','VE5','EX030704','SH0','IS0','EX030102',
  ]) {
    if (!_port) break
    try { await _write(cmd) } catch { /* non-fatal */ }
    await new Promise(r => setTimeout(r, 40))
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getKnownPorts(): Promise<any[]> {
  if (!isSupported) return []
  return (navigator as any).serial.getPorts()
}

/**
 * Open a port and connect to the FTX-1 transceiver.  Pass a known SerialPort
 * object to skip the browser picker, or omit to show the picker dialog.
 * Throws on user cancel (NotFoundError) or unknown radio ID.
 */
export async function connect(baudRate = 38400, knownPort?: any): Promise<void> {
  if (state.value.connected || connecting.value) throw new Error('Already connected or connecting')
  if (!isSupported) throw new Error('Web Serial API not supported — use Chrome or Edge.')

  connecting.value = true
  try {
    const port = knownPort ?? await (navigator as any).serial.requestPort()
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' })
    _port = port
    _writer = port.writable.getWriter()

    // Start the read loop concurrently — do NOT await
    _startReadLoop(port)

    // Identify radio — abort if not FTX-1
    const idResp = await _sendAndWait('ID', 2000)
    if (idResp.substring(2) !== '0840') {
      throw new Error(`Unknown radio ID: ${idResp.substring(2)} (expected 0840 for FTX-1)`)
    }

    await _enableAutoInfo()
    await _initialSync()
    _initialSync2() // fire-and-forget; AI mode handles unsolicited responses

    _patch({ connected: true, baudRate, port: 'Web Serial', error: null })
    _wireSerialEvents()
  } catch (e) {
    // Clean up partial connection
    if (_reader) { try { await _reader.cancel() } catch { /* ignore */ } _reader = null }
    if (_writer) { try { _writer.releaseLock() } catch { /* ignore */ } _writer = null }
    if (_port)   { try { await _port.close()   } catch { /* ignore */ } _port   = null }
    _drainQueue(new Error('Connection failed'))
    throw e
  } finally {
    connecting.value = false
  }
}

/** Gracefully disconnect — sends AI0, releases locks, closes port. */
export async function disconnect(): Promise<void> {
  _unwireSerialEvents()
  try { await _write('AI0') } catch { /* best-effort */ }
  _drainQueue(new Error('Disconnected'))
  if (_reader) { try { await _reader.cancel() } catch { /* ignore */ } _reader = null }
  if (_writer) { try { _writer.releaseLock()  } catch { /* ignore */ } _writer = null }
  if (_port)   { try { await _port.close()    } catch { /* ignore */ } _port   = null }
  state.value = defaultState()
}

/**
 * Fire-and-forget CAT command (AI mode — the radio pushes the state change
 * back automatically).  Mirrors the /command POST endpoint behaviour
 * including follow-up queries for commands that don't generate AI responses.
 */
export async function send(cmd: string): Promise<void> {
  const clean = cmd.replace(/;+$/, '').trim()
  await _write(clean)

  // Commands that don't generate AI unsolicited notifications need a follow-up
  // read query so the state stays in sync.
  const prefix = clean.substring(0, 2).toUpperCase()
  let followUp: string | null = null
  if (prefix === 'SS' && clean.length > 2) followUp = 'SS' + clean.substring(2, 4)
  else if (prefix === 'RG' && clean.length > 3) followUp = 'RG' + clean[2]
  if (followUp) setTimeout(() => _write(followUp!).catch(() => {}), 150)
}

/**
 * Execute a preset (array of CAT commands) with 60 ms inter-command delay.
 * Returns per-command results for the PresetButton UI.
 */
export async function sendPreset(commands: string[]): Promise<CommandResult[]> {
  const results: CommandResult[] = []
  for (const raw of commands) {
    const cmd = raw.replace(/;+$/, '').trim()
    if (!cmd) continue
    try {
      await _write(cmd)
      results.push({ command: cmd, ok: true })
    } catch (e: any) {
      results.push({ command: cmd, error: e.message, ok: false })
    }
    await new Promise(r => setTimeout(r, 60))
  }
  return results
}

export async function readMemoryChannel(slot: number): Promise<RadioChannel | null> {
  const slotStr = String(slot).padStart(5, '0')
  try {
    await send('MC0' + slotStr)
    await _sendAndWait('MR' + slotStr, 1500)
    const ch = state.value.radioChannels[slot]
    if (ch) {
      try { await _sendAndWait('MZ' + slotStr, 1000) } catch { /* no split data */ }
      try { await _sendAndWait('MT' + slotStr, 1000) } catch { /* no tag */ }
      const sqlType = ch.sqlType ?? 0
      if (sqlType > 0) {
        let ctcssIdx: number | null = null
        let dcsIdx: number | null = null
        // CN0x always queries VFO 0 (main); channel recall uses MC0 so this is consistent.
        if (sqlType <= 2) {
          try {
            const resp = await _sendAndWait('CN00', 1000)
            const idx = parseInt(resp.substring(4), 10)
            ctcssIdx = isNaN(idx) ? null : idx
          } catch { }
        } else {
          try {
            const resp = await _sendAndWait('CN01', 1000)
            const idx = parseInt(resp.substring(4), 10)
            dcsIdx = isNaN(idx) ? null : idx
          } catch { }
        }
        const channels = { ...state.value.radioChannels }
        channels[slot] = { ...channels[slot], ctcssIdx, dcsIdx }
        _patch({ radioChannels: channels })
      }
    }
    return state.value.radioChannels[slot] ?? null
  } catch {
    return null
  }
}

export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  let origFreq = ''
  try {
    const resp = await _sendAndWait('FA', 1500)
    origFreq = resp.substring(2)
  } catch { /* proceed without restore if FA query fails */ }

  try { await _sendAndWait('AI0', 1000) } catch { }

  await send('VM011')
  try {
    for (let i = from; i <= to; i++) {
      if (!state.value.connected) break
      await readMemoryChannel(i)
    }
  } finally {
    try {
      await send('VM000')
      if (origFreq) await send('FA' + origFreq)
    } catch { }
    try { await _sendAndWait('AI1', 1000) } catch { }
  }
}

export async function writeMemoryChannel(slot: number, config: MemoryWriteConfig): Promise<void> {
  if (slot === 0) throw new Error('Slot 0 is not a valid memory channel')
  const slotStr   = String(slot).padStart(5, '0')
  const freqStr   = String(config.freq).padStart(9, '0')
  const modeCode  = MODE_CODE[config.mode ?? ''] ?? '2'
  const sqlType   = config.sqlType ?? 0
  const splitBit  = (config.splitMem && config.txFreq != null) ? '1' : '0'
  const txFreqStr = String(config.txFreq ?? config.freq).padStart(9, '0')

  // MR P8 (sqlCode in MW) uses different ordering than CT P2 — see CAT-notes.md
  const mrSqlCode = [0, 2, 1, 3, 4, 5][sqlType] ?? 0

  // MW creates/overwrites the slot unconditionally — MC0 rejects empty slots so
  // MW must come first. Payload mirrors MR response format (27 chars).
  const clarDir = config.clarDir ?? '+'
  const clarOff = String(config.clarOffset ?? 0).padStart(4, '0')
  const rxClar  = config.rxClar  ? '1' : '0'
  const txClar  = config.txClar  ? '1' : '0'
  const shift   = config.shift   != null ? String(config.shift) : '0'
  await send('MW' + slotStr + freqStr + clarDir + clarOff + rxClar + txClar
                  + modeCode + '1' + String(mrSqlCode) + '00' + shift)
  await new Promise(r => setTimeout(r, 100))

  // MW has no field for CTCSS/DCS tone index — use VFO+CN+MC0+AM to write tone.
  // MC0 succeeds now because the slot was just created by MW.
  const needTone = (sqlType >= 1 && sqlType <= 2 && config.ctcssIdx != null)
                || (sqlType >= 3 && sqlType <= 5 && config.dcsIdx    != null)
  if (needTone) {
    await send('VM000')
    await send('FA' + freqStr)
    await send('MD0' + modeCode)
    await send('CT0' + String(sqlType))
    if (sqlType >= 1 && sqlType <= 2 && config.ctcssIdx != null)
      await send('CN00' + String(config.ctcssIdx).padStart(3, '0'))
    if (sqlType >= 3 && sqlType <= 5 && config.dcsIdx != null)
      await send('CN01' + String(config.dcsIdx).padStart(3, '0'))
    await send('MC0' + slotStr)
    await send('VM000')
    await send('AM')
    await new Promise(r => setTimeout(r, 200))
  }

  await send('MZ' + slotStr + splitBit + txFreqStr)
  if (config.tag != null) {
    const tag = config.tag.substring(0, 12).padEnd(12, ' ')
    await send('MT' + slotStr + tag)
  }
  await new Promise(r => setTimeout(r, 100))
}

// FTX-1 CAT has no per-slot delete command (MW only accepts P7=1; P7=0/4 return ?;).
// Best available: overwrite the slot with blank defaults (29 MHz, USB, no SQL, empty tag).
// The slot stays in radio memory but with no useful content.
export async function deleteMemorySlot(slot: number): Promise<void> {
  if (slot === 0) throw new Error('Slot 0 is not a valid memory channel')
  const slotStr = String(slot).padStart(5, '0')
  await send('VM000')
  await send('FA029000000')
  await send('MD02')
  await send('CT00')
  await send('MC0' + slotStr)
  await send('VM000')
  await send('AM')
  await new Promise(r => setTimeout(r, 150))
  await send('MZ' + slotStr + '0029000000')
  await send('MT' + slotStr + '            ')
}

/** Composable entry-point — returns the singleton controller. */
export function useSerial() {
  return { state, connecting, isSupported, connect, disconnect, send, sendPreset, getKnownPorts, readMemoryChannel, scanMemoryChannels, writeMemoryChannel, deleteMemorySlot }
}
