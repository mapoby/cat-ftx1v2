import { describe, test, expect } from 'vitest'
import { parseResponse, MODE_MAP, MODE_CODE, AGC_MAP, FUNC_KNOB } from '../../composables/catParser'
import { defaultState } from '../../composables/useSerial'
import type { TransceiverState } from '../../composables/useSerial'

function base(): TransceiverState {
  return defaultState()
}

// ── FA — main frequency ──────────────────────────────────────────────────────

describe('FA — main frequency', () => {
  test('parses 14 MHz', () => {
    const delta = parseResponse('FA', '00014225000', base())
    expect(delta.mainFreq).toBe(14225000)
  })
  test('returns null for zero frequency', () => {
    const delta = parseResponse('FA', '00000000000', base())
    expect(delta.mainFreq).toBeNull()
  })
  test('parses 7 MHz', () => {
    const delta = parseResponse('FA', '00007074000', base())
    expect(delta.mainFreq).toBe(7074000)
  })
})

// ── FB — sub frequency ───────────────────────────────────────────────────────

describe('FB — sub frequency', () => {
  test('parses 7 MHz', () => {
    const delta = parseResponse('FB', '00007074000', base())
    expect(delta.subFreq).toBe(7074000)
  })
  test('returns null for zero frequency', () => {
    const delta = parseResponse('FB', '00000000000', base())
    expect(delta.subFreq).toBeNull()
  })
})

// ── FD — scope side ───────────────────────────────────────────────────────────

describe('FD — scope side', () => {
  test('returns only scopeSide: 1', () => {
    const delta = parseResponse('FD', '1', base())
    expect(delta).toEqual({ scopeSide: 1 })
  })
  test('returns only scopeSide: 0', () => {
    const delta = parseResponse('FD', '0', base())
    expect(delta).toEqual({ scopeSide: 0 })
  })
})

// ── MD — mode ────────────────────────────────────────────────────────────────

describe('MD — mode', () => {
  test('main VFO USB sets mainMode and no narrowMain', () => {
    const delta = parseResponse('MD', '02', base())
    expect(delta.mainMode).toBe('USB')
    expect(delta.narrowMain).toBeUndefined()
  })
  test('main VFO FM-N sets mainMode and narrowMain=1', () => {
    const delta = parseResponse('MD', '0B', base())
    expect(delta.mainMode).toBe('FM-N')
    expect(delta.narrowMain).toBe(1)
  })
  test('main VFO FM sets narrowMain=0', () => {
    const delta = parseResponse('MD', '04', base())
    expect(delta.mainMode).toBe('FM')
    expect(delta.narrowMain).toBe(0)
  })
  test('sub VFO LSB sets subMode', () => {
    const delta = parseResponse('MD', '11', base())
    expect(delta.subMode).toBe('LSB')
    expect(delta.mainMode).toBeUndefined()
  })
  test('sub VFO FM-N sets narrowSub=1', () => {
    const delta = parseResponse('MD', '1B', base())
    expect(delta.subMode).toBe('FM-N')
    expect(delta.narrowSub).toBe(1)
  })
})

// ── SM — S-meter ──────────────────────────────────────────────────────────────

describe('SM — S-meter', () => {
  test('sourceCmd SM0 sets mainSmeter', () => {
    const delta = parseResponse('SM', '0015', base(), 'SM0')
    expect(delta.mainSmeter).toBe(15)
    expect(delta.subSmeter).toBeUndefined()
  })
  test('sourceCmd SM1 sets subSmeter', () => {
    const delta = parseResponse('SM', '1020', base(), 'SM1')
    expect(delta.subSmeter).toBe(20)
    expect(delta.mainSmeter).toBeUndefined()
  })
  test('no sourceCmd, params[0]=0 sets mainSmeter', () => {
    const delta = parseResponse('SM', '0010', base())
    expect(delta.mainSmeter).toBe(10)
  })
  test('no sourceCmd, params[0]=1 sets subSmeter', () => {
    const delta = parseResponse('SM', '1008', base())
    expect(delta.subSmeter).toBe(8)
  })
})

// ── TX — transmit state ───────────────────────────────────────────────────────

describe('TX — transmit state', () => {
  test('params[0]=1 sets txState true', () => {
    const delta = parseResponse('TX', '1', base())
    expect(delta.txState).toBe(true)
  })
  test('params[0]=2 sets txState true', () => {
    const delta = parseResponse('TX', '2', base())
    expect(delta.txState).toBe(true)
  })
  test('params[0]=0 sets txState false', () => {
    const delta = parseResponse('TX', '0', base())
    expect(delta.txState).toBe(false)
  })
})

// ── MX — MOX ─────────────────────────────────────────────────────────────────

describe('MX — MOX', () => {
  test('1 sets mox true', () => {
    const delta = parseResponse('MX', '1', base())
    expect(delta.mox).toBe(true)
  })
  test('0 sets mox false', () => {
    const delta = parseResponse('MX', '0', base())
    expect(delta.mox).toBe(false)
  })
})

// ── ST — split ────────────────────────────────────────────────────────────────

describe('ST — split', () => {
  test('1 sets split true', () => {
    const delta = parseResponse('ST', '1', base())
    expect(delta.split).toBe(true)
  })
  test('0 sets split false', () => {
    const delta = parseResponse('ST', '0', base())
    expect(delta.split).toBe(false)
  })
})

// ── GT — AGC ─────────────────────────────────────────────────────────────────

describe('GT — AGC', () => {
  test('VFO 0 maps all 7 AGC codes for main', () => {
    const codes = Object.entries(AGC_MAP)
    for (const [code, label] of codes) {
      const delta = parseResponse('GT', `0${code}`, base())
      expect(delta.agcMain).toBe(label)
    }
  })
  test('VFO 1 maps AGC for sub', () => {
    const delta = parseResponse('GT', '12', base())
    expect(delta.agcSub).toBe('MID')
    expect(delta.agcMain).toBeUndefined()
  })
})

// ── RG — RF gain ──────────────────────────────────────────────────────────────

describe('RG — RF gain', () => {
  test('VFO 0 sets rfGainMain', () => {
    const delta = parseResponse('RG', '0100', base())
    expect(delta.rfGainMain).toBe(100)
  })
  test('VFO 1 sets rfGainSub', () => {
    const delta = parseResponse('RG', '1050', base())
    expect(delta.rfGainSub).toBe(50)
    expect(delta.rfGainMain).toBeUndefined()
  })
})

// ── AG — AF gain ──────────────────────────────────────────────────────────────

describe('AG — AF gain', () => {
  test('VFO 0 sets afGainMain', () => {
    const delta = parseResponse('AG', '0200', base())
    expect(delta.afGainMain).toBe(200)
  })
  test('VFO 1 sets afGainSub', () => {
    const delta = parseResponse('AG', '1100', base())
    expect(delta.afGainSub).toBe(100)
  })
})

// ── SQ — squelch ──────────────────────────────────────────────────────────────

describe('SQ — squelch', () => {
  test('VFO 0 sets sqMain', () => {
    const delta = parseResponse('SQ', '0050', base())
    expect(delta.sqMain).toBe(50)
  })
  test('VFO 1 sets sqSub', () => {
    const delta = parseResponse('SQ', '1025', base())
    expect(delta.sqSub).toBe(25)
  })
})

// ── PC — power level ─────────────────────────────────────────────────────────

describe('PC — power level', () => {
  test('parses power with leading digit ignored', () => {
    const delta = parseResponse('PC', '1100', base())
    expect(delta.powerLevel).toBe(100)
  })
  test('returns 0 for zero power (valid value)', () => {
    const delta = parseResponse('PC', '1000', base())
    expect(delta.powerLevel).toBe(0)
  })
})

// ── AO — AMC level ───────────────────────────────────────────────────────────

describe('AO — AMC level', () => {
  test('parses amcLevel', () => {
    const delta = parseResponse('AO', '50', base())
    expect(delta.amcLevel).toBe(50)
  })
  test('returns 0 for zero AMC level (valid value)', () => {
    const delta = parseResponse('AO', '0', base())
    expect(delta.amcLevel).toBe(0)
  })
})

// ── MG — mic gain ────────────────────────────────────────────────────────────

describe('MG — mic gain', () => {
  test('parses micGain', () => {
    const delta = parseResponse('MG', '75', base())
    expect(delta.micGain).toBe(75)
  })
})

// ── PR — speech processor ────────────────────────────────────────────────────

describe('PR — speech processor', () => {
  test('sets speechProc true when params[0]=1 and params[1]=1', () => {
    const delta = parseResponse('PR', '11', base())
    expect(delta.speechProc).toBe(true)
  })
  test('sets speechProc false when params[0]=1 and params[1]=0', () => {
    const delta = parseResponse('PR', '10', base())
    expect(delta.speechProc).toBe(false)
  })
  test('returns empty delta when params[0] is not 1', () => {
    const delta = parseResponse('PR', '01', base())
    expect(delta.speechProc).toBeUndefined()
  })
})

// ── PL — speech proc level ───────────────────────────────────────────────────

describe('PL — speech proc level', () => {
  test('parses speechProcLevel', () => {
    const delta = parseResponse('PL', '80', base())
    expect(delta.speechProcLevel).toBe(80)
  })
})

// ── VX — VOX ─────────────────────────────────────────────────────────────────

describe('VX — VOX', () => {
  test('1 sets vox true', () => {
    const delta = parseResponse('VX', '1', base())
    expect(delta.vox).toBe(true)
  })
  test('0 sets vox false', () => {
    const delta = parseResponse('VX', '0', base())
    expect(delta.vox).toBe(false)
  })
})

// ── VG — VOX gain ────────────────────────────────────────────────────────────

describe('VG — VOX gain', () => {
  test('parses voxGain', () => {
    const delta = parseResponse('VG', '50', base())
    expect(delta.voxGain).toBe(50)
  })
})

// ── RM — reading meter ───────────────────────────────────────────────────────

describe('RM — reading meter', () => {
  test('mode 0 sets both mainSmeter and subSmeter', () => {
    const delta = parseResponse('RM', '0015203', base())
    expect(delta.mainSmeter).toBe(15)
    expect(delta.subSmeter).toBe(203)
  })
  test('mode 1 sets mainSmeter only', () => {
    const delta = parseResponse('RM', '1020', base())
    expect(delta.mainSmeter).toBe(20)
    expect(delta.subSmeter).toBeUndefined()
  })
  test('mode 2 sets subSmeter only', () => {
    const delta = parseResponse('RM', '2030', base())
    expect(delta.subSmeter).toBe(30)
    expect(delta.mainSmeter).toBeUndefined()
  })
})

// ── RL — DNR ─────────────────────────────────────────────────────────────────

describe('RL — DNR', () => {
  test('VFO 0 value 00 sets dnrMain to OFF', () => {
    const delta = parseResponse('RL', '000', base())
    expect(delta.dnrMain).toBe('OFF')
  })
  test('VFO 0 value 03 sets dnrMain to 3', () => {
    const delta = parseResponse('RL', '003', base())
    expect(delta.dnrMain).toBe(3)
  })
  test('VFO 1 value 00 sets dnrSub to OFF', () => {
    const delta = parseResponse('RL', '100', base())
    expect(delta.dnrSub).toBe('OFF')
  })
})

// ── RI — radio info ───────────────────────────────────────────────────────────

describe('RI — radio info', () => {
  test('parses all 8 subfields', () => {
    // params[1]=hiSwr, [2]=recording, [3]=tx, [5]=tuning, [6]=scanning, [7]=squelchOpen
    const delta = parseResponse('RI', '01110010', base())
    expect(delta.radioInfo?.hiSwr).toBe(true)
    expect(delta.radioInfo?.recording).toBe(true)
    expect(delta.radioInfo?.playing).toBe(false)
    expect(delta.radioInfo?.tx).toBe(true)
    expect(delta.radioInfo?.txInhibit).toBe(false)
    expect(delta.radioInfo?.tuning).toBe(false)
    expect(delta.radioInfo?.scanning).toBe(true)
    expect(delta.radioInfo?.squelchOpen).toBe(false)
    expect(delta.txState).toBe(true)
  })
  test('skips short params', () => {
    const delta = parseResponse('RI', '0110', base())
    expect(delta.radioInfo).toBeUndefined()
  })
})

// ── IF — info ─────────────────────────────────────────────────────────────────

describe('IF — info', () => {
  test('parses mainFreq and mainMode from full params', () => {
    // 5 prefix chars + 9-digit freq at 5-13 + 7 chars + mode code at 21
    const p = '00000014225000000000 2      '
    const delta = parseResponse('IF', p, base())
    expect(delta.mainFreq).toBe(14225000)
    expect(delta.mainMode).toBe('USB')
  })
  test('ignores short params', () => {
    const delta = parseResponse('IF', '12345', base())
    expect(delta.mainFreq).toBeUndefined()
  })
})

// ── OI — opposite info ────────────────────────────────────────────────────────

describe('OI — opposite info', () => {
  test('parses subFreq and subMode from full params', () => {
    // 5 prefix chars + 9-digit freq at 5-13 + 7 chars + mode code at 21
    const p = '00000007074000000000 1      '
    const delta = parseResponse('OI', p, base())
    expect(delta.subFreq).toBe(7074000)
    expect(delta.subMode).toBe('LSB')
  })
  test('ignores short params', () => {
    const delta = parseResponse('OI', '12345', base())
    expect(delta.subFreq).toBeUndefined()
  })
})

// ── SF — function knob ────────────────────────────────────────────────────────

describe('SF — function knob', () => {
  test('maps code D to RF POWER', () => {
    const delta = parseResponse('SF', '0D', base())
    expect(delta.funcKnob).toBe('RF POWER')
  })
  test('maps code 7 to MIC GAIN', () => {
    const delta = parseResponse('SF', '07', base())
    expect(delta.funcKnob).toBe('MIC GAIN')
  })
})

// ── VE — firmware version ────────────────────────────────────────────────────

describe('VE — firmware version', () => {
  test('sets main firmware and preserves other fields', () => {
    // VE format: params[0]=sub-type, params[1]=separator, params[2..5]=4-char version
    const current = base()
    current.firmware = { main: null, display: '5678', sdr: null, dsp: null, spa1: null, fc80: null }
    const delta = parseResponse('VE', '001234', current)
    expect(delta.firmware!.main).toBe('1234')
    expect(delta.firmware!.display).toBe('5678')
  })
  test('sets display firmware (params[0]=1)', () => {
    const delta = parseResponse('VE', '101234', base())
    expect(delta.firmware!.display).toBe('1234')
    expect(delta.firmware!.main).toBeNull()
  })
  test('sets sdr firmware (params[0]=2)', () => {
    const delta = parseResponse('VE', '201234', base())
    expect(delta.firmware!.sdr).toBe('1234')
  })
  test('sets dsp firmware (params[0]=3)', () => {
    const delta = parseResponse('VE', '301234', base())
    expect(delta.firmware!.dsp).toBe('1234')
  })
  test('sets spa1 firmware (params[0]=4)', () => {
    const delta = parseResponse('VE', '401234', base())
    expect(delta.firmware!.spa1).toBe('1234')
  })
  test('sets fc80 firmware (params[0]=5)', () => {
    const delta = parseResponse('VE', '501234', base())
    expect(delta.firmware!.fc80).toBe('1234')
  })
  test('ignores short params', () => {
    const delta = parseResponse('VE', '0123', base())
    expect(delta.firmware).toBeUndefined()
  })
})

// ── EX — extension settings ───────────────────────────────────────────────────

describe('EX — extension settings', () => {
  test('030704 prefix sets antSelect=1', () => {
    const delta = parseResponse('EX', '0307041', base())
    expect(delta.antSelect).toBe(1)
  })
  test('030704 prefix sets antSelect=0', () => {
    const delta = parseResponse('EX', '0307040', base())
    expect(delta.antSelect).toBe(0)
  })
  test('030102 prefix sets sqlRfMode', () => {
    const delta = parseResponse('EX', '0301022', base())
    expect(delta.sqlRfMode).toBe(2)
  })
})

// ── RA — RF attenuator ────────────────────────────────────────────────────────

describe('RA — RF attenuator', () => {
  test('params[1]=1 sets rfAttenuator true', () => {
    const delta = parseResponse('RA', '01', base())
    expect(delta.rfAttenuator).toBe(true)
  })
  test('params[1]=0 sets rfAttenuator false', () => {
    const delta = parseResponse('RA', '00', base())
    expect(delta.rfAttenuator).toBe(false)
  })
})

// ── PA — preamp ───────────────────────────────────────────────────────────────

describe('PA — preamp', () => {
  test('band=0 sets preAmpHf', () => {
    const delta = parseResponse('PA', '01', base())
    expect(delta.preAmpHf).toBe(1)
  })
  test('band=1 sets preAmpVhf true', () => {
    const delta = parseResponse('PA', '11', base())
    expect(delta.preAmpVhf).toBe(true)
  })
  test('band=1 value=0 sets preAmpVhf false', () => {
    const delta = parseResponse('PA', '10', base())
    expect(delta.preAmpVhf).toBe(false)
  })
  test('band=2 sets preAmpUhf true', () => {
    const delta = parseResponse('PA', '21', base())
    expect(delta.preAmpUhf).toBe(true)
  })
})

// ── FT — TX VFO ───────────────────────────────────────────────────────────────

describe('FT — TX VFO', () => {
  test('1 sets txVfo=1', () => {
    const delta = parseResponse('FT', '1', base())
    expect(delta.txVfo).toBe(1)
  })
  test('0 sets txVfo=0', () => {
    const delta = parseResponse('FT', '0', base())
    expect(delta.txVfo).toBe(0)
  })
})

// ── FR — RX mode ─────────────────────────────────────────────────────────────

describe('FR — RX mode', () => {
  test('01 sets rxMode=single', () => {
    const delta = parseResponse('FR', '01', base())
    expect(delta.rxMode).toBe('single')
  })
  test('00 sets rxMode=dual', () => {
    const delta = parseResponse('FR', '00', base())
    expect(delta.rxMode).toBe('dual')
  })
})

// ── CT — SQL type ─────────────────────────────────────────────────────────────

describe('CT — SQL type', () => {
  test('sourceCmd CT0 sets mainSqlType', () => {
    const delta = parseResponse('CT', '02', base(), 'CT0')
    expect(delta.mainSqlType).toBe(2)
    expect(delta.subSqlType).toBeUndefined()
  })
  test('sourceCmd CT1 sets subSqlType', () => {
    const delta = parseResponse('CT', '13', base(), 'CT1')
    expect(delta.subSqlType).toBe(3)
    expect(delta.mainSqlType).toBeUndefined()
  })
  test('no sourceCmd, params[0]=1 sets subSqlType', () => {
    const delta = parseResponse('CT', '12', base())
    expect(delta.subSqlType).toBe(2)
  })
})

// ── CN — CTCSS / DCS code ────────────────────────────────────────────────────

describe('CN — CTCSS/DCS code', () => {
  test('vfo=0, type=0 sets mainCtcssTone', () => {
    const delta = parseResponse('CN', '0010', base())
    expect(delta.mainCtcssTone).toBe(10)
  })
  test('vfo=0, type=1 sets mainDcsCode', () => {
    const delta = parseResponse('CN', '0115', base())
    expect(delta.mainDcsCode).toBe(15)
  })
  test('vfo=1, type=0 sets subCtcssTone', () => {
    const delta = parseResponse('CN', '1007', base())
    expect(delta.subCtcssTone).toBe(7)
  })
  test('vfo=1, type=1 sets subDcsCode', () => {
    const delta = parseResponse('CN', '1120', base())
    expect(delta.subDcsCode).toBe(20)
  })
})

// ── SH — bandwidth ────────────────────────────────────────────────────────────

describe('SH — bandwidth', () => {
  test('sourceCmd SH0 sets mainBandwidth', () => {
    const delta = parseResponse('SH', '012', base(), 'SH0')
    expect(delta.mainBandwidth).toBe(12)
    expect(delta.subBandwidth).toBeUndefined()
  })
  test('sourceCmd SH1 sets subBandwidth', () => {
    const delta = parseResponse('SH', '108', base(), 'SH1')
    expect(delta.subBandwidth).toBe(8)
  })
  test('no sourceCmd, params[0]=1 sets subBandwidth', () => {
    const delta = parseResponse('SH', '105', base())
    expect(delta.subBandwidth).toBe(5)
  })
})

// ── IS — IF shift ─────────────────────────────────────────────────────────────

describe('IS — IF shift', () => {
  test('vfo=0 sets mainShift', () => {
    const delta = parseResponse('IS', '00+500', base())
    expect(delta.mainShift).toBe(500)
  })
  test('vfo=1 sets subShift', () => {
    const delta = parseResponse('IS', '10-200', base())
    expect(delta.subShift).toBe(-200)
  })
})

// ── NA — narrow ───────────────────────────────────────────────────────────────

describe('NA — narrow', () => {
  test('sourceCmd NA0 sets narrowMain=1', () => {
    const delta = parseResponse('NA', '01', base(), 'NA0')
    expect(delta.narrowMain).toBe(1)
    expect(delta.narrowSub).toBeUndefined()
  })
  test('sourceCmd NA0, params[1]=0 sets narrowMain=0', () => {
    const delta = parseResponse('NA', '00', base(), 'NA0')
    expect(delta.narrowMain).toBe(0)
  })
  test('sourceCmd NA1 sets narrowSub', () => {
    const delta = parseResponse('NA', '11', base(), 'NA1')
    expect(delta.narrowSub).toBe(1)
  })
  test('no sourceCmd, params[0]=1 sets narrowSub', () => {
    const delta = parseResponse('NA', '11', base())
    expect(delta.narrowSub).toBe(1)
  })
})

// ── LK — lock ────────────────────────────────────────────────────────────────

describe('LK — lock', () => {
  test('1 sets lock true', () => {
    const delta = parseResponse('LK', '1', base())
    expect(delta.lock).toBe(true)
  })
  test('0 sets lock false', () => {
    const delta = parseResponse('LK', '0', base())
    expect(delta.lock).toBe(false)
  })
})

// ── SS — scope settings ───────────────────────────────────────────────────────

describe('SS — scope settings', () => {
  test('params[1]=5 sets scope.span', () => {
    const delta = parseResponse('SS', '053', base())
    expect(delta.scope?.span).toBe(3)
  })
  test('params[1]=0 sets scope.speed', () => {
    const delta = parseResponse('SS', '002', base())
    expect(delta.scope?.speed).toBe(2)
  })
  test('params[1]=2 sets scope.marker', () => {
    const delta = parseResponse('SS', '021', base())
    expect(delta.scope?.marker).toBe(true)
  })
  test('params[1]=3 sets scope.color (hex)', () => {
    const delta = parseResponse('SS', '03A', base())
    expect(delta.scope?.color).toBe(10)
  })
  test('params[1]=4 sets scope.level', () => {
    const delta = parseResponse('SS', '040050', base())
    expect(delta.scope?.level).toBe(50)
  })
  test('params[1]=6 sets scope.mode', () => {
    const delta = parseResponse('SS', '061', base())
    expect(delta.scope?.mode).toBe(1)
  })
  test('params[1]=7 sets scope.att', () => {
    const delta = parseResponse('SS', '072', base())
    expect(delta.scope?.att).toBe(2)
  })
  test('preserves other scope fields from current state', () => {
    const current = base()
    current.scope = { mode: 1, span: 2, speed: 3, level: 4, att: 5, color: 6, marker: true }
    const delta = parseResponse('SS', '053', current)
    expect(delta.scope?.span).toBe(3)
    expect(delta.scope?.mode).toBe(1)
    expect(delta.scope?.speed).toBe(3)
  })
})

// ── AI — auto info ────────────────────────────────────────────────────────────

describe('AI — auto info', () => {
  test('1 sets autoInfo true', () => {
    const delta = parseResponse('AI', '1', base())
    expect(delta.autoInfo).toBe(true)
  })
  test('0 sets autoInfo false', () => {
    const delta = parseResponse('AI', '0', base())
    expect(delta.autoInfo).toBe(false)
  })
})

// ── MR — memory channel ───────────────────────────────────────────────────────

describe('MR — memory channel', () => {
  test('parses slot, freq, mode, sqlType', () => {
    // MR params: 5-digit slot + 9-digit freq + clarDir + 4-digit clarOffset + rxClar + txClar + mode + 2 unknown + sqlType + unknown + unknown + shift
    const delta = parseResponse('MR', '00001014225000+000000211100', base())
    expect(delta.radioChannels![1].freq).toBe(14225000)
    expect(delta.radioChannels![1].mode).toBe('USB')
  })
  test('preserves ctcssIdx from current state', () => {
    const current = base()
    current.radioChannels[1] = {
      slot: 1, freq: 14000000, ctcssIdx: 5, dcsIdx: null,
      txFreq: null, splitMem: false, mode: 'USB', sqlType: 1,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false,
      shift: 0, tag: 'TEST'
    }
    const delta = parseResponse('MR', '00001014225000+000000211100', current)
    expect(delta.radioChannels![1].ctcssIdx).toBe(5)
    expect(delta.radioChannels![1].tag).toBe('TEST')
  })
  test('ignores slot 0', () => {
    const delta = parseResponse('MR', '00000014225000+000000211100', base())
    expect(delta.radioChannels).toBeUndefined()
  })
  test('parses rxClar and txClar flags', () => {
    const delta = parseResponse('MR', '00001014225000+000011211100', base())
    expect(delta.radioChannels![1].rxClar).toBe(true)
    expect(delta.radioChannels![1].txClar).toBe(true)
  })
})

// ── MZ — memory split ─────────────────────────────────────────────────────────

describe('MZ — memory split', () => {
  test('updates splitMem and txFreq for existing channel', () => {
    const current = base()
    current.radioChannels[1] = {
      slot: 1, freq: 14225000, ctcssIdx: null, dcsIdx: null,
      txFreq: null, splitMem: false, mode: 'USB', sqlType: 0,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false,
      shift: 0, tag: null
    }
    const delta = parseResponse('MZ', '000011014300000', current)
    expect(delta.radioChannels![1].splitMem).toBe(true)
    expect(delta.radioChannels![1].txFreq).toBe(14300000)
  })
  test('returns empty delta if channel does not exist', () => {
    const delta = parseResponse('MZ', '000011014300000', base())
    expect(delta.radioChannels).toBeUndefined()
  })
  test('sets txFreq null when splitMem is false', () => {
    const current = base()
    current.radioChannels[1] = {
      slot: 1, freq: 14225000, ctcssIdx: null, dcsIdx: null,
      txFreq: 14300000, splitMem: true, mode: 'USB', sqlType: 0,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false,
      shift: 0, tag: null
    }
    const delta = parseResponse('MZ', '000010014300000', current)
    expect(delta.radioChannels![1].splitMem).toBe(false)
    expect(delta.radioChannels![1].txFreq).toBeNull()
  })
})

// ── MT — memory tag ───────────────────────────────────────────────────────────

describe('MT — memory tag', () => {
  test('updates tag with trimEnd for existing channel', () => {
    const current = base()
    current.radioChannels[1] = {
      slot: 1, freq: 14225000, ctcssIdx: null, dcsIdx: null,
      txFreq: null, splitMem: false, mode: 'USB', sqlType: 0,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false,
      shift: 0, tag: null
    }
    const delta = parseResponse('MT', '00001MYSTATION  ', current)
    expect(delta.radioChannels![1].tag).toBe('MYSTATION')
  })
  test('returns empty delta if channel does not exist', () => {
    const delta = parseResponse('MT', '00001MYSTATION  ', base())
    expect(delta.radioChannels).toBeUndefined()
  })
})

// ── Unknown opcode ────────────────────────────────────────────────────────────

describe('unknown opcode', () => {
  test('ZZ returns empty object', () => {
    const delta = parseResponse('ZZ', '12345', base())
    expect(Object.keys(delta)).toHaveLength(0)
  })
})

// ── Export maps sanity ────────────────────────────────────────────────────────

describe('exported maps', () => {
  test('MODE_MAP has 18 entries', () => {
    expect(Object.keys(MODE_MAP).length).toBe(18)
  })
  test('MODE_CODE is the inverse of MODE_MAP', () => {
    expect(MODE_CODE['USB']).toBe('2')
    expect(MODE_CODE['LSB']).toBe('1')
    expect(MODE_CODE['FM-N']).toBe('B')
  })
  test('AGC_MAP has 7 entries', () => {
    expect(Object.keys(AGC_MAP).length).toBe(7)
  })
  test('FUNC_KNOB has D entry for RF POWER', () => {
    expect(FUNC_KNOB['D']).toBe('RF POWER')
  })
})
