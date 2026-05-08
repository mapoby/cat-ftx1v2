import type { TransceiverState } from './useSerial'

// ── CAT decode maps ──────────────────────────────────────────────────────────

export const MODE_MAP: Record<string, string> = {
  '0': 'AMS',  '1': 'LSB',  '2': 'USB',      '3': 'CW-U',     '4': 'FM',
  '5': 'AM',   '6': 'RTTY-L','7': 'CW-L',    '8': 'DATA-L',   '9': 'RTTY-U',
  'A': 'DATA-FM','B': 'FM-N','C': 'DATA-U',  'D': 'AM-N',     'E': 'PSK',
  'F': 'DATA-FM-N', 'H': 'C4FM-DN', 'I': 'C4FM-VW',
}

export const MODE_CODE: Record<string, string> = {
  'AMS': '0', 'LSB': '1', 'USB': '2', 'CW-U': '3', 'FM': '4',
  'AM': '5', 'RTTY-L': '6', 'CW-L': '7', 'DATA-L': '8', 'RTTY-U': '9',
  'DATA-FM': 'A', 'FM-N': 'B', 'DATA-U': 'C', 'AM-N': 'D', 'PSK': 'E',
  'DATA-FM-N': 'F', 'C4FM-DN': 'H', 'C4FM-VW': 'I',
}

export const AGC_MAP: Record<string, string> = {
  '0': 'OFF', '1': 'FAST', '2': 'MID', '3': 'SLOW',
  '4': 'AUTO-F', '5': 'AUTO-M', '6': 'AUTO-S',
}

export const FUNC_KNOB: Record<string, string> = {
  '0': '-', '1': 'D-LEVEL', '2': 'PEAK',    '3': 'COLOR',   '4': 'CONTRAST',
  '5': 'DIMMER', '6': '-',  '7': 'MIC GAIN','8': 'PROC LEVEL','9': 'AMC LEVEL',
  'A': 'VOX GAIN','B': 'VOX DELAY','C': '-','D': 'RF POWER', 'E': 'MONI LEVEL',
  'F': 'CW SPEED','G': 'CW PITCH', 'H': 'BK-DELAY',
}

export function parseResponse(
  cmd: string,
  params: string,
  current: TransceiverState,
  sourceCmd: string | null = null,
): Partial<TransceiverState> {
  const s = current
  const ch: Partial<TransceiverState> = {}

  switch (cmd) {
    case 'FA': { const v = parseInt(params, 10); ch.mainFreq = (!isNaN(v) && v > 0) ? v : null; break }
    case 'FB': { const v = parseInt(params, 10); ch.subFreq  = (!isNaN(v) && v > 0) ? v : null; break }

    case 'FD': {
      ch.scopeSide = params[0] === '1' ? 1 : 0
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

    case 'PC': { const v = parseInt(params.substring(1), 10); ch.powerLevel = isNaN(v) ? null : v; break }
    case 'AO': { const v = parseInt(params, 10); ch.amcLevel = isNaN(v) ? null : v; break }
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
        ch.subSmeter  = parseInt(params.substring(4, 7), 10)
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
      const sqlType = parseInt(params[1], 10)
      if (!isNaN(sqlType)) {
        if (vfo === '0') ch.mainSqlType = sqlType
        else if (vfo === '1') ch.subSqlType = sqlType
      }
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
      const idx = parseInt(params.substring(1, 3), 10)
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

  return ch
}
