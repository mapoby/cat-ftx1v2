// Browser-side CAT controller using the Web Serial API.
// Replaces the Node.js serial-server.mjs — no backend required.
// State is fully reactive; components subscribe via useSerial().state.

import { shallowRef, ref } from 'vue'

// ── CAT decode maps ──────────────────────────────────────────────────────────

const MODE_MAP: Record<string, string> = {
  '0': 'AMS',  '1': 'LSB',  '2': 'USB',      '3': 'CW-U',     '4': 'FM',
  '5': 'AM',   '6': 'RTTY-L','7': 'CW-L',    '8': 'DATA-L',   '9': 'RTTY-U',
  'A': 'DATA-FM','B': 'FM-N','C': 'DATA-U',  'D': 'AM-N',     'E': 'PSK',
  'F': 'DATA-FM-N', 'H': 'C4FM-DN', 'I': 'C4FM-VW',
}

const MODE_CODE: Record<string, string> = {
  'AMS': '0', 'LSB': '1', 'USB': '2', 'CW-U': '3', 'FM': '4',
  'AM': '5', 'RTTY-L': '6', 'CW-L': '7', 'DATA-L': '8', 'RTTY-U': '9',
  'DATA-FM': 'A', 'FM-N': 'B', 'DATA-U': 'C', 'AM-N': 'D', 'PSK': 'E',
  'DATA-FM-N': 'F', 'C4FM-DN': 'H', 'C4FM-VW': 'I',
}

const AGC_MAP: Record<string, string> = {
  '0': 'OFF', '1': 'FAST', '2': 'MID', '3': 'SLOW',
  '4': 'AUTO-F', '5': 'AUTO-M', '6': 'AUTO-S',
}

const FUNC_KNOB: Record<string, string> = {
  '0': '-', '1': 'D-LEVEL', '2': 'PEAK',    '3': 'COLOR',   '4': 'CONTRAST',
  '5': 'DIMMER', '6': '-',  '7': 'MIC GAIN','8': 'PROC LEVEL','9': 'AMC LEVEL',
  'A': 'VOX GAIN','B': 'VOX DELAY','C': '-','D': 'RF POWER', 'E': 'MONI LEVEL',
  'F': 'CW SPEED','G': 'CW PITCH', 'H': 'BK-DELAY',
}

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

function defaultState(): TransceiverState {
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
    if (e) { clearTimeout(e.timer); e.reject(new Error('CAT error response')) }
    return
  }

  const prefix = response.substring(0, 2).toUpperCase()

  // Solicited: head of queue expects this prefix → resolve it
  if (_queue.length > 0 && _queue[0].cmd.substring(0, 2).toUpperCase() === prefix) {
    const e = _queue.shift()!
    clearTimeout(e.timer)
    _parseResponse(prefix, response.substring(2), e.cmd)
    e.resolve(response)
    return
  }

  // Unsolicited AI frame
  _parseResponse(prefix, response.substring(2))
}

// ── Full CAT response decoder (mirrors serial-server.mjs _parseResponse) ─────

function _parseResponse(cmd: string, params: string, sourceCmd: string | null = null): void {
  const s = state.value
  const ch: Partial<TransceiverState> = {}

  switch (cmd) {
    case 'FA': ch.mainFreq = parseInt(params, 10) || null; break
    case 'FB': ch.subFreq  = parseInt(params, 10) || null; break

    case 'FD': {
      const side = params[0] === '1' ? 1 : 0
      ch.scopeSide = side
      // Unsolicited scope-side change — re-query scope params for the new side
      ;(async () => {
        for (const c of [`SS${side}5`, `SS${side}4`, `SS${side}0`, `SS${side}3`, `SS${side}6`]) {
          if (!_port) break
          try { await _write(c) } catch { /* non-fatal */ }
          await new Promise(r => setTimeout(r, 40))
        }
      })()
      break
    }

    case 'MD': {
      const mode = MODE_MAP[params[1]?.toUpperCase()] ?? params[1] ?? null
      if (params[0] === '0') {
        ch.mainMode = mode
        if (mode === 'FM-N' || mode === 'AM-N' || mode === 'DATA-FM-N') ch.narrowMain = 1
        else if (mode === 'FM' || mode === 'AM' || mode === 'DATA-FM')   ch.narrowMain = 0
      } else if (params[0] === '1') {
        ch.subMode = mode
        if (mode === 'FM-N' || mode === 'AM-N' || mode === 'DATA-FM-N') ch.narrowSub = 1
        else if (mode === 'FM' || mode === 'AM' || mode === 'DATA-FM')   ch.narrowSub = 0
      }
      break
    }

    case 'SM': {
      const vfo = sourceCmd ? sourceCmd[2] : params[0]
      if (vfo === '0') ch.mainSmeter = parseInt(params.substring(1), 10)
      else if (vfo === '1') ch.subSmeter = parseInt(params.substring(1), 10)
      break
    }

    case 'TX': ch.txState = params[0] === '1' || params[0] === '2'; break
    case 'MX': ch.mox   = params[0] === '1'; break
    case 'ST': ch.split = params[0] === '1'; break

    case 'GT':
      if (params[0] === '0') ch.agcMain = AGC_MAP[params[1]] ?? params[1] ?? null
      else if (params[0] === '1') ch.agcSub = AGC_MAP[params[1]] ?? params[1] ?? null
      break

    case 'RG':
      if (params[0] === '0') ch.rfGainMain = parseInt(params.substring(1), 10)
      else if (params[0] === '1') ch.rfGainSub  = parseInt(params.substring(1), 10)
      break

    case 'AG':
      if (params[0] === '0') ch.afGainMain = parseInt(params.substring(1), 10)
      else if (params[0] === '1') ch.afGainSub  = parseInt(params.substring(1), 10)
      break

    case 'SQ':
      if (params[0] === '0') ch.sqMain = parseInt(params.substring(1), 10)
      else if (params[0] === '1') ch.sqSub  = parseInt(params.substring(1), 10)
      break

    case 'PC': ch.powerLevel = parseInt(params.substring(1), 10) || null; break
    case 'AO': ch.amcLevel   = parseInt(params, 10) || null; break
    case 'MG': ch.micGain    = parseInt(params, 10); break

    case 'PR':
      if (params[0] === '1') ch.speechProc = params[1] === '1'
      break

    case 'PL': ch.speechProcLevel = parseInt(params, 10); break
    case 'VX': ch.vox     = params[0] === '1'; break
    case 'VG': ch.voxGain = parseInt(params, 10); break

    case 'RM':
      if (params[0] === '1') ch.mainSmeter = parseInt(params.substring(1, 4), 10)
      else if (params[0] === '2') ch.subSmeter = parseInt(params.substring(1, 4), 10)
      else if (params[0] === '0') {
        ch.mainSmeter = parseInt(params.substring(1, 4), 10)
        ch.subSmeter  = parseInt(params.substring(4, 8), 10)
      }
      break

    case 'RL': {
      if (params[0] === '0') {
        const v = parseInt(params.substring(1, 3), 10)
        ch.dnrMain = v === 0 ? 'OFF' : v
      } else if (params[0] === '1') {
        const v = parseInt(params.substring(1, 3), 10)
        ch.dnrSub = v === 0 ? 'OFF' : v
      }
      break
    }

    case 'RI':
      if (params.length >= 8) {
        ch.radioInfo = {
          hiSwr: params[1] === '1', recording: params[2] === '1', playing: params[2] === '2',
          tx: params[3] === '1', txInhibit: params[3] === '2',
          tuning: params[5] === '1', scanning: params[6] === '1' || params[6] === '2',
          squelchOpen: params[7] === '1',
        }
        ch.txState = params[3] === '1'
      }
      break

    case 'IF':
      if (params.length >= 27) {
        const freq = parseInt(params.substring(5, 14), 10)
        if (freq > 0) ch.mainFreq = freq
        const mode = params[21]?.toUpperCase()
        if (mode) ch.mainMode = MODE_MAP[mode] ?? mode
      }
      break

    case 'OI':
      if (params.length >= 27) {
        const freq = parseInt(params.substring(5, 14), 10)
        if (freq > 0) ch.subFreq = freq
        const mode = params[21]?.toUpperCase()
        if (mode) ch.subMode = MODE_MAP[mode] ?? mode
      }
      break

    case 'SF': {
      const k = params[1]?.toUpperCase()
      if (k) ch.funcKnob = FUNC_KNOB[k] ?? k
      break
    }

    case 'VE':
      if (params.length >= 5) {
        const fw = { ...(s.firmware ?? { main: null, display: null, sdr: null, dsp: null, spa1: null, fc80: null }) }
        if      (params[0] === '0') fw.main    = params.substring(2, 6)
        else if (params[0] === '1') fw.display = params.substring(2, 6)
        else if (params[0] === '2') fw.sdr     = params.substring(2, 6)
        else if (params[0] === '3') fw.dsp     = params.substring(2, 6)
        else if (params[0] === '4') fw.spa1    = params.substring(2, 6)
        else if (params[0] === '5') fw.fc80    = params.substring(2, 6)
        ch.firmware = fw
      }
      break

    case 'EX':
      if (params.startsWith('030704'))  ch.antSelect = params[6] === '1' ? 1 : 0
      else if (params.startsWith('030102')) ch.sqlRfMode = parseInt(params[6], 10)
      break

    case 'RA': ch.rfAttenuator = params[1] === '1'; break

    case 'PA': {
      const band = params[0]; const val = parseInt(params[1], 10)
      if      (band === '0') ch.preAmpHf  = isNaN(val) ? null : val
      else if (band === '1') ch.preAmpVhf = val === 1
      else if (band === '2') ch.preAmpUhf = val === 1
      break
    }

    case 'FT': ch.txVfo  = params[0] === '1' ? 1 : 0; break
    case 'FR': ch.rxMode = params === '01' ? 'single' : 'dual'; break

    case 'CT': {
      const vfo = sourceCmd ? sourceCmd[2] : params[0]
      const sqlType = parseInt(params[1] ?? params[0], 10)
      if (vfo === '0') ch.mainSqlType = isNaN(sqlType) ? null : sqlType
      else if (vfo === '1') ch.subSqlType  = isNaN(sqlType) ? null : sqlType
      break
    }

    case 'CN': {
      const vfo = params[0]; const type = params[1]
      const num = parseInt(params.substring(2), 10)
      if (!isNaN(num)) {
        if (type === '0') {
          if (vfo === '0') ch.mainCtcssTone = num
          else if (vfo === '1') ch.subCtcssTone = num
        } else if (type === '1') {
          if (vfo === '0') ch.mainDcsCode = num
          else if (vfo === '1') ch.subDcsCode  = num
        }
      }
      break
    }

    case 'SH': {
      const vfo = sourceCmd ? sourceCmd[2] : params[0]
      const idx = parseInt(params.substring(2, 4), 10)
      if (vfo === '0') ch.mainBandwidth = isNaN(idx) ? null : idx
      else if (vfo === '1') ch.subBandwidth  = isNaN(idx) ? null : idx
      break
    }

    case 'IS': {
      const vfo = params[0]; const val = parseInt(params.substring(2), 10)
      if (vfo === '0') ch.mainShift = isNaN(val) ? null : val
      else if (vfo === '1') ch.subShift  = isNaN(val) ? null : val
      break
    }

    case 'NA': {
      const vfo = sourceCmd ? sourceCmd[2] : params[0]
      if (vfo === '0') ch.narrowMain = params[1] === '1' ? 1 : 0
      else if (vfo === '1') ch.narrowSub  = params[1] === '1' ? 1 : 0
      break
    }

    case 'LK': ch.lock = params[0] === '1'; break

    case 'SS':
      if (params.length >= 3) {
        const scope = { ...(s.scope ?? { mode: null, span: null, speed: null, level: null, att: null, color: null, marker: true }) }
        if      (params[1] === '0') scope.speed  = parseInt(params[2], 10)
        else if (params[1] === '2') scope.marker = params[2] === '1'
        else if (params[1] === '3') scope.color  = parseInt(params[2], 16)
        else if (params[1] === '4') scope.level  = parseInt(params.substring(2, 6), 10)
        else if (params[1] === '5') scope.span   = parseInt(params[2], 10)
        else if (params[1] === '6') scope.mode   = parseInt(params[2], 10)
        else if (params[1] === '7') scope.att    = parseInt(params[2], 10)
        ch.scope = scope
      }
      break

    case 'AI': ch.autoInfo = params[0] === '1'; break

    case 'MR':
      if (params.length >= 27) {
        const slot     = parseInt(params.substring(0, 5), 10)
        const freq     = parseInt(params.substring(5, 14), 10)
        const clarDir  = params[14] === '+' || params[14] === '-' ? params[14] : null
        const clarOffset = parseInt(params.substring(15, 19), 10)
        const rxClar   = params[19] === '1'
        const txClar   = params[20] === '1'
        const mode     = MODE_MAP[params[21]?.toUpperCase()] ?? null
        const sqlType  = parseInt(params[23], 10)
        const shift    = parseInt(params[26], 10)
        if (slot > 0 && freq > 0) {
          const channels = { ...s.radioChannels }
          const prev = s.radioChannels[slot]
          channels[slot] = {
            slot, freq,
            txFreq:   prev?.txFreq ?? null,
            splitMem: prev?.splitMem ?? false,
            mode,
            sqlType:    isNaN(sqlType) ? null : sqlType,
            clarDir,
            clarOffset: isNaN(clarOffset) ? null : clarOffset,
            rxClar, txClar,
            shift: isNaN(shift) ? 0 : shift,
            tag: prev?.tag ?? null,
            ctcssIdx: prev?.ctcssIdx ?? null,
            dcsIdx:   prev?.dcsIdx   ?? null,
          }
          ch.radioChannels = channels
        }
      }
      break

    case 'MZ':
      if (params.length >= 15) {
        const slot     = parseInt(params.substring(0, 5), 10)
        const splitMem = params[5] === '1'
        const txFreq   = parseInt(params.substring(6, 15), 10)
        if (slot > 0 && s.radioChannels[slot]) {
          const channels = { ...s.radioChannels }
          channels[slot] = {
            ...channels[slot],
            splitMem,
            txFreq: splitMem && txFreq > 0 ? txFreq : null,
          }
          ch.radioChannels = channels
        }
      }
      break

    case 'MT':
      if (params.length >= 5) {
        const slot = parseInt(params.substring(0, 5), 10)
        const tag  = params.substring(5, 17).trimEnd()
        if (slot > 0 && s.radioChannels[slot]) {
          const channels = { ...s.radioChannels }
          channels[slot] = { ...channels[slot], tag }
          ch.radioChannels = channels
        }
      }
      break
  }

  if (Object.keys(ch).length > 0) _patch(ch)
}

// ── Command queue: send and wait for response ────────────────────────────────

function _sendAndWait(cmd: string, timeoutMs = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = _queue.findIndex(e => e === entry)
      if (idx >= 0) _queue.splice(idx, 1)
      reject(new Error(`Timeout: ${cmd}`))
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
    await _sendAndWait('MR' + slotStr, 1500)
    const ch = state.value.radioChannels[slot]
    if (ch) {
      try { await _sendAndWait('MZ' + slotStr, 1000) } catch { /* no split data */ }
      try { await _sendAndWait('MT' + slotStr, 1000) } catch { /* no tag */ }
      const sqlType = ch.sqlType ?? 0
      if (sqlType > 0) {
        // Switch to memory mode to read CTCSS/DCS tone for this slot via CN query
        await send('VM011')
        await send('MC0' + slotStr)
        await new Promise(r => setTimeout(r, 100))
        let ctcssIdx: number | null = null
        let dcsIdx: number | null = null
        if (sqlType <= 2) {
          try { await _sendAndWait('CN00', 1000); ctcssIdx = state.value.mainCtcssTone } catch { }
        } else {
          try { await _sendAndWait('CN01', 1000); dcsIdx = state.value.mainDcsCode } catch { }
        }
        await send('VM000')
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
  for (let i = from; i <= to; i++) {
    if (!state.value.connected) break
    await readMemoryChannel(i)
  }
}

export async function writeMemoryChannel(slot: number, config: MemoryWriteConfig): Promise<void> {
  const slotStr   = String(slot).padStart(5, '0')
  const freqStr   = String(config.freq).padStart(9, '0')
  const modeCode  = MODE_CODE[config.mode ?? ''] ?? '2'
  const sqlCode   = String(config.sqlType ?? 0)
  const shiftCode = String(config.shift ?? 0)
  const clarDir   = config.clarDir ?? '+'
  const clarOff   = String(config.clarOffset ?? 0).padStart(4, '0')
  const rxClar    = config.rxClar ? '1' : '0'
  const txClar    = config.txClar ? '1' : '0'
  const payload   = slotStr + freqStr + clarDir + clarOff + rxClar + txClar + modeCode + '1' + sqlCode + '00' + shiftCode
  await send('MW' + payload)
  const txFreqStr = String(config.txFreq ?? config.freq).padStart(9, '0')
  const splitBit  = (config.splitMem && config.txFreq != null) ? '1' : '0'
  await send('MZ' + slotStr + splitBit + txFreqStr)
  if (config.tag != null) {
    const tag = config.tag.substring(0, 12).padEnd(12, ' ')
    await send('MT' + slotStr + tag)
  }
  const sqlType = config.sqlType ?? 0
  if (sqlType > 0 && (config.ctcssIdx != null || config.dcsIdx != null)) {
    // Set VFO to target state first (while still in VFO mode so FA/MD0 take effect),
    // then switch to memory mode, select slot, and commit with AM.
    await send('FA' + freqStr)
    await send('MD0' + modeCode)
    await send('CT0' + String(sqlType))
    if (config.ctcssIdx != null) await send('CN00' + String(config.ctcssIdx).padStart(3, '0'))
    if (config.dcsIdx   != null) await send('CN01' + String(config.dcsIdx).padStart(3, '0'))
    await send('VM011')          // switch main side to memory mode
    await send('MC0' + slotStr)  // select target slot
    await send('AM')             // store VFO → memory slot
    await send('VM000')          // restore VFO mode
    // AM may overwrite split and tag; re-send to restore
    await send('MZ' + slotStr + splitBit + txFreqStr)
    if (config.tag != null) {
      const tag = config.tag.substring(0, 12).padEnd(12, ' ')
      await send('MT' + slotStr + tag)
    }
  }
}

/** Composable entry-point — returns the singleton controller. */
export function useSerial() {
  return { state, connecting, isSupported, connect, disconnect, send, sendPreset, getKnownPorts, readMemoryChannel, scanMemoryChannels, writeMemoryChannel }
}
