<template>
  <div class="app">
    <!-- ── Header / Connection Bar ── -->
    <header class="header">
      <div class="header-brand">
        <span class="brand-logo">FTX-1</span>
        <span class="brand-sub">CAT Controller</span>
        <span class="brand-version">{{ appVersion }}</span>
      </div>

      <div class="conn-bar">
        <select v-if="knownPorts.length" v-model.number="selectedPortIdx" class="sel port-sel" :disabled="state.connected">
          <option :value="-1">Pick port…</option>
          <option v-for="(p, i) in knownPorts" :key="i" :value="i">{{ portLabel(p, i) }}</option>
        </select>

        <select v-model="selectedBaud" class="sel baud-sel" :disabled="state.connected">
          <option :value="4800">4800</option>
          <option :value="9600">9600</option>
          <option :value="19200">19200</option>
          <option :value="38400">38400</option>
          <option :value="115200">115200</option>
        </select>

        <button class="btn" :class="state.connected ? 'btn-danger' : 'btn-primary'" @click="toggleConnection" :disabled="connecting">
          {{ connecting ? '…' : state.connected ? 'Disconnect' : 'Connect' }}
        </button>
      </div>

      <div v-if="!isSupported" class="compat-warning">
        ⚠ Web Serial API not supported — use Chrome or Edge
      </div>

      <div class="conn-status" :class="state.connected ? 'status-ok' : 'status-off'">
        {{ state.connected ? '● Connected' : '○ Disconnected' }}
      </div>
    </header>

    <!-- ── Error banner ── -->
    <div v-if="lastError" class="error-banner">
      {{ lastError }}
      <button class="close-btn" @click="lastError = null">✕</button>
    </div>

    <!-- ── Main dashboard (only when connected) ── -->
    <main v-if="state.connected" class="dashboard">

      <!-- ── Tab bar ── -->
      <nav class="tab-bar">
        <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'dashboard' }" @click="activeTab = 'dashboard'">Dashboard</button>
        <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'channels' }" @click="activeTab = 'channels'">Channel List</button>
      </nav>

      <!-- ── Dashboard tab ── -->
      <div v-show="activeTab === 'dashboard'">

      <!-- TX/RX Indicator + FUNC KNOB row -->
      <div class="txbar">
        <div class="btns">
            <button
              class="btn tx-indicator power-off"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('PS0')"
              title="POWER OFF"
            >POWER OFF</button>
        </div>
        
        <div class="tx-indicator" :class="{ 'tx-active': state.txState || state.mox }">
          <span>{{ (state.txState || state.mox) ? 'TX' : 'RX' }}</span>
          <span v-if="state.radioInfo?.hiSwr" class="swr-alarm">HI-SWR!</span>
        </div>

        <div class="func-knob-widget">
          <span class="func-knob-label">FUNC KNOB</span>:
          <span class="func-knob-value">{{ state.funcKnob ?? '--' }}</span>
          <div class="func-knob-btns">
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'D-LEVEL' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF01')"
              title="SET FUNC KNOB → D-LEVEL"
            >D-LEVEL</button>
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'RF POWER' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF0D')"
              title="SET FUNC KNOB → RF POWER"
            >RF POWER</button>
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'MIC GAIN' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF07')"
              title="SET FUNC KNOB → MIC GAIN"
            >MIC GAIN</button>
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'AMC LEVEL' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF09')"
              title="SET FUNC KNOB → AMC LEVEL"
            >AMC LEVEL</button>
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'PROC LEVEL' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF08')"
              title="SET FUNC KNOB → PROC LEVEL"
            >PROC LEVEL</button>
            <button
              class="btn btn-ghost btn-sm func-knob-label"
              :class="{ 'btn-active': state.funcKnob === 'VOX GAIN' }"
              :disabled="!state.connected || funcKnobBusy"
              @click="setFuncKnob('SF0A')"
              title="SET FUNC KNOB → VOX GAIN"
            >VOX GAIN</button>
            <button
                class="btn btn-ghost btn-sm func-knob-label"
                :class="{ 'btn-active': state.funcKnob === 'MONI LEVEL' }"
                :disabled="!state.connected || funcKnobBusy"
                @click="setFuncKnob('SF0E')"
                title="SET FUNC KNOB → MONI LEVEL"
            >MONI LEVEL</button>
            <button
                class="btn btn-ghost btn-sm func-knob-label"
                :class="{ 'btn-active': state.funcKnob === 'CONTRAST' }"
                :disabled="!state.connected || funcKnobBusy"
                @click="setFuncKnob('SF04')"
                title="SET FUNC KNOB → CONTRAST"
            >CONTRAST</button>
            <button
                class="btn btn-ghost btn-sm func-knob-label"
                :class="{ 'btn-active': state.funcKnob === 'DIMMER' }"
                :disabled="!state.connected || funcKnobBusy"
                @click="setFuncKnob('SF05')"
                title="SET FUNC KNOB → DIMMER"
            >DIMMER</button>
          </div>
        </div>
      </div>
    
      <!-- ── VFO Section ── -->
      <section class="vfo-section">
        <!-- SUB VFO -->
        <div class="vfo-card sub-card"
          :class="{
            'vfo-card--tx-vfo':    state.txVfo === 1,
            'vfo-card--inactive':  state.rxMode === 'single' && state.txVfo === 0 && state.split,
            'vfo-card--switchable': state.rxMode === 'single' && state.txVfo === 0 && !state.split,
          }"
        >
          <div v-if="state.rxMode === 'single' && state.txVfo === 0 && !state.split" class="vfo-switch-overlay" @click="switchToVfo('1')" />
          <div class="vfo-header">
            <span class="vfo-label">SUB</span>
            <span v-if="state.txVfo === 1" class="tx-vfo-badge">TX/RX</span>
            <span v-else class="rx-vfo-badge" @click="switchToVfo('1')">RX</span>
            <button v-if="state.txVfo === 1" class="band-sel btn-up" :disabled="state.txState || state.mox" @click="sendUp()">Up</button>
            <button v-if="state.txVfo === 1" class="band-sel btn-up" :disabled="state.txState || state.mox" @click="sendDn()">Dn</button>
            <button
              class="band-sel"
              :disabled="bandBusy || state.txState || state.mox"
              @click="openBandPopup('1')"
            >{{ subBandCode != null ? BANDS.find(b => b.code === subBandCode)?.label : 'band…' }}</button>
            <button
              class="mode-sel"
              :style="modeBadgeStyle(state.subMode)"
              :disabled="modeBusy || state.txState || state.mox"
              @click="openModePopup('1')"
            >{{ state.subMode ?? '--' }}</button>
          </div>
          <div class="freq-row">
            <!--div class="freq-display freq-sub">
              {{ formatFreq(state.subFreq) }}
            </div>
            <div class="freq-sep" / -->
            <div class="freq-tuner freq-sub" :class="{ 'freq-tx': state.txState || state.mox }">
              <template v-for="(group, gi) in freqGroups(state.subFreq)" :key="gi">
                <span v-if="gi > 0" class="freq-dot">.</span>
                <div class="freq-group" @wheel.prevent="onFreqWheel('1', gi, $event)">{{ group }}</div>
              </template>
            </div>
            <span class="freq-unit">MHz</span>
            <!-- BandwidthDisplay :mode="state.subMode" :bandwidth="state.subBandwidth" :shift="state.subShift"
              @update:bandwidth="setBandwidth('1', $event)"
              @update:shift="setShift('1', $event)"
            / -->
            <div v-if="isFmMode(state.subMode) && state.subSqlType !== null && state.subSqlType !== 0" class="sql-row">
            <span class="sql-badge" :style="{ background: sqlTypeColor(state.subSqlType) + '28', borderColor: sqlTypeColor(state.subSqlType), color: sqlTypeColor(state.subSqlType) }">
              {{ sqlTypeLabel(state.subSqlType) }}
              <span v-if="toneDisplay(state.subSqlType, state.subCtcssTone, state.subDcsCode)" class="sql-tone">
              {{ toneDisplay(state.subSqlType, state.subCtcssTone, state.subDcsCode) }}
            </span>
            </span>
            </div>
          </div>
          <SMeter :value="state.subSmeter" label="SUB S-meter" />
          <LevelBar :value="state.afGainSub" label="VOLUME" color="linear-gradient(90deg,#a60f0f,#c60f0f)" :clickable="true" :wheelable="true" @update="setAfGain('1', $event)" />
          <LevelBar v-if="(state.sqlRfMode===0)||((state.sqlRfMode===2)&&isRfGainMode(state.subMode))" :value="state.rfGainSub" label="RF GAIN" color="linear-gradient(90deg,#f59e0b,#fcd34d)" :clickable="true" @update="setRfGain('1', $event)" />
          <LevelBar v-if="(state.sqlRfMode===1)||((state.sqlRfMode===2)&&(!isRfGainMode(state.subMode)))" :value="state.sqSub" label="SQUELCH" color="linear-gradient(90deg,#f59e0b,#fcd34d)" :clickable="true" @update="setSquelch('1', $event)" />
          <br/>
          <section class="status-section">
            <StatusBadge label="AGC" :value="state.agcSub ?? '--'" :active="state.agcSub !== null && state.agcSub !== 'OFF'" color-active="#10b981" :clickable="state.agcSub !== null" :busy="agcBusy" @toggle="cycleAgc('1')" />
            <StatusBadge label="NARROW" :value="state.narrowSub != null ? (state.narrowSub ? 'ON' : 'OFF') : '--'" :active="state.narrowSub === true" color-active="#a78bfa" :clickable="state.narrowSub !== null" :busy="narrowBusy" @toggle="toggleNarrow('1')" />
            <div class="dnr-wrap" :class="{ 'dnr-wrap--active': isDnrMode(state.subMode) }" @wheel.prevent="onDnrWheel('1', $event)">
              <StatusBadge label="DNR" :value="state.dnrSub != null ? String(state.dnrSub) : '--'" :active="isDnrMode(state.subMode) && state.dnrSub != null && state.dnrSub !== 'OFF' && state.dnrSub !== 0" color-active="#22d3ee" />
            </div>
            <StatusBadge label="Tone SQL" :value="state.subSqlType != null ? sqlTypeLabel(state.subSqlType) : '--'" :active="state.subSqlType>0" color-active="#10b981" :clickable="true" :busy="sqlTypeBusy" @toggle="cycleSqlType('1', state.subSqlType)" />
            <StatusBadge label="CTCSS" :value="state.subCtcssTone != null ? (CTCSS_TONES[state.subCtcssTone]?.toFixed(1) + ' Hz') : '--'" :clickable="true" :active="ctcssPopupVfo === '1'" @toggle="openCtcssPopup('1')" />
            <StatusBadge label="DCS" :value="state.subDcsCode != null ? ('D' + String(DCS_CODES[state.subDcsCode]).padStart(3, '0')) : '--'" :clickable="true" :active="dcsPopupVfo === '1'" @toggle="openDcsPopup('1')" />
            <StatusBadge label="SAVE CH" value="ADD" color-active="#f97316" :clickable="state.subFreq !== null" @toggle="saveChannelFromVfo('1')" />
          </section>
        </div>

        <!-- MAIN VFO -->
        <div class="vfo-card main-card"
             :class="{
            'vfo-card--tx-vfo':    state.txVfo === 0,
            'vfo-card--inactive':  state.rxMode === 'single' && state.txVfo === 1 && state.split,
            'vfo-card--switchable': state.rxMode === 'single' && state.txVfo === 1 && !state.split,
          }"
        >
          <div
            v-if="state.rxMode === 'single' && state.txVfo === 1 && !state.split"
            class="vfo-switch-overlay"
            @click="switchToVfo('0')"
          />
          <div class="vfo-header">
            <span class="vfo-label">MAIN</span>
            <span v-if="state.txVfo === 0" class="tx-vfo-badge">TX/RX</span>
            <span v-else class="rx-vfo-badge"  @click="switchToVfo('0')">RX</span>
            <button v-if="state.txVfo === 0" class="band-sel btn-up" :disabled="state.txState || state.mox" @click="sendUp()">Up</button>
            <button v-if="state.txVfo === 0" class="band-sel btn-up" :disabled="state.txState || state.mox" @click="sendDn()">Dn</button>
            <button
                class="band-sel"
                :disabled="bandBusy || state.txState || state.mox"
                @click="openBandPopup('0')"
            >{{ mainBandCode != null ? BANDS.find(b => b.code === mainBandCode)?.label : 'band…' }}</button>
            <button
                class="mode-sel"
                :style="modeBadgeStyle(state.mainMode)"
                :disabled="modeBusy || state.txState || state.mox"
                @click="openModePopup('0')"
            >{{ state.mainMode ?? '--' }}</button>
          </div>
          <div class="freq-row">
            <!-- div class="freq-display" :class="{ 'freq-tx': state.txState || state.mox }">
              {{ formatFreq(state.mainFreq) }}
            </div>
            <div class="freq-sep" / -->
            <div class="freq-tuner" :class="{ 'freq-tx': state.txState || state.mox }">
              <template v-for="(group, gi) in freqGroups(state.mainFreq)" :key="gi">
                <span v-if="gi > 0" class="freq-dot">.</span>
                <div class="freq-group" @wheel.prevent="onFreqWheel('0', gi, $event)">{{ group }}</div>
              </template>
            </div>
            <span class="freq-unit">MHz</span>
            <BandwidthDisplay
              :mode="state.mainMode"
              :bandwidth="state.mainBandwidth"
              :shift="state.mainShift"
              @update:bandwidth="setBandwidth('0', $event)"
              @update:shift="setShift('0', $event)"
            />
            <div v-if="isFmMode(state.mainMode) && state.mainSqlType !== null && state.mainSqlType !== 0" class="sql-row">
              <span class="sql-badge" :style="{ background: sqlTypeColor(state.mainSqlType) + '28', borderColor: sqlTypeColor(state.mainSqlType), color: sqlTypeColor(state.mainSqlType) }">
                {{ sqlTypeLabel(state.mainSqlType) }}
                <span v-if="toneDisplay(state.mainSqlType, state.mainCtcssTone, state.mainDcsCode)" class="sql-tone">{{ toneDisplay(state.mainSqlType, state.mainCtcssTone, state.mainDcsCode) }}
                </span>
              </span>
            </div>
          </div>
          <SMeter :value="state.mainSmeter" label="MAIN S-meter" />
          <LevelBar :value="state.afGainMain" label="VOLUME" color="linear-gradient(90deg,#a60f0f,#c60f0f)" :clickable="true" :wheelable="true" @update="setAfGain('0', $event)" />
          <LevelBar v-if="(state.sqlRfMode===0)||((state.sqlRfMode===2)&&isRfGainMode(state.subMode))" :value="state.rfGainMain" label="RF GAIN" color="linear-gradient(90deg,#f59e0b,#fcd34d)" :clickable="true" @update="setRfGain('0', $event)" />
          <LevelBar v-if="(state.sqlRfMode===1)||((state.sqlRfMode===2)&&(!isRfGainMode(state.subMode)))" :value="state.sqMain" label="SQUELCH" color="linear-gradient(90deg,#f59e0b,#fcd34d)" :clickable="true" @update="setSquelch('0', $event)" />
          <br/>
          <section class="status-section">
            <StatusBadge label="AGC" :value="state.agcMain ?? '--'" :active="state.agcMain !== null && state.agcMain !== 'OFF'" color-active="#10b981" :clickable="state.agcMain !== null" :busy="agcBusy" @toggle="cycleAgc('0')" />
            <StatusBadge label="NARROW" :value="state.narrowMain != null ? (state.narrowMain ? 'ON' : 'OFF') : '--'" :active="state.narrowMain === true" color-active="#a78bfa" :clickable="state.narrowMain !== null" :busy="narrowBusy" @toggle="toggleNarrow('0')" />
            <div class="dnr-wrap" :class="{ 'dnr-wrap--active': isDnrMode(state.mainMode) }" @wheel.prevent="onDnrWheel('0', $event)">
              <StatusBadge label="DNR" :value="state.dnrMain != null ? String(state.dnrMain) : '--'" :active="isDnrMode(state.mainMode) && state.dnrMain != null && state.dnrMain !== 'OFF' && state.dnrMain !== 0" color-active="#22d3ee" />
            </div>
            <StatusBadge label="Tone SQL" :value="state.mainSqlType != null ? sqlTypeLabel(state.mainSqlType) : '--'" :active="state.mainSqlType>0" color-active="#10b981" :clickable="true" :busy="sqlTypeBusy" @toggle="cycleSqlType('0', state.mainSqlType)" />
            <StatusBadge label="CTCSS" :value="state.mainCtcssTone != null ? (CTCSS_TONES[state.mainCtcssTone]?.toFixed(1) + ' Hz') : '--'" :clickable="true" :active="ctcssPopupVfo === '0'" @toggle="openCtcssPopup('0')" />
            <StatusBadge label="DCS" :value="state.mainDcsCode != null ? ('D' + String(DCS_CODES[state.mainDcsCode]).padStart(3, '0')) : '--'" :clickable="true" :active="dcsPopupVfo === '0'" @toggle="openDcsPopup('0')" />
            <StatusBadge label="SAVE CH" value="ADD" color-active="#f97316" :clickable="state.mainFreq !== null" @toggle="saveChannelFromVfo('0')" />
          </section>
        </div>

      </section>

      <!-- ── Status Grid ── -->
      <section class="status-section">
        <StatusBadge label="RX MODE" :value="state.rxMode?.toUpperCase() ?? '--'" :active="state.rxMode === 'dual'" color-active="#10b981" :clickable="state.rxMode !== null" :busy="rxModeBusy" @toggle="toggleRxMode" />
        <StatusBadge label="SPLIT" :value="state.split ? 'ON' : 'OFF'" :active="state.split" :clickable="true" :busy="splitBusy" @toggle="toggleSplit" />
        <StatusBadge label="MOX" :value="state.mox ? 'ON' : 'OFF'" :active="state.mox" color-active="#ef4444" :clickable="true" :busy="moxBusy" @toggle="toggleMox" />
        <StatusBadge label="LOCK" :value="state.lock != null ? (state.lock ? 'ON' : 'OFF') : '--'" :active="state.lock === true" color-active="#f59e0b" :clickable="state.lock !== null" :busy="lockBusy" @toggle="toggleLock" />
        <div class="dnr-wrap" :class="{ 'dnr-wrap--active': state.powerLevel != null }" @wheel.prevent="onPwrWheel">
          <StatusBadge label="PWR" :value="state.powerLevel != null ? state.powerLevel + ' W' : '--'" />
        </div>
        <StatusBadge label="SWAP" :value="'<->'" :active="false" :clickable="true" :busy="splitBusy" @toggle="toggleSwap"  />
        <StatusBadge label="TUNER" :value="state.radioInfo?.tuning ? 'TUNING' : 'IDLE'" :active="state.radioInfo?.tuning" />
        <StatusBadge label="SQL/RF" :value="state.sqlRfMode != null ? (['RF','SQL','SQL FM'][state.sqlRfMode] ?? '--') : '--'" :clickable="true" @toggle="toggleRfSql" />
        <div class="dnr-wrap" :class="{ 'dnr-wrap--active': state.micGain != null }" @wheel.prevent="onMicGainWheel">
          <StatusBadge label="MIC GAIN" :value="state.micGain != null ? String(state.micGain) : '--'" />
        </div>
        <div class="dnr-wrap" :class="{ 'dnr-wrap--active': state.amcLevel != null }" @wheel.prevent="onAmcWheel">
          <StatusBadge label="AMC" :value="state.amcLevel != null ? String(state.amcLevel) : '--'" />
        </div>
        <StatusBadge label="MIC EQ" :value="speechProcLabel" :active="state.speechProc === true" color-active="#10b981" :clickable="state.speechProc !== null" :busy="speechProcBusy" @toggle="toggleSpeechProc" />
        <div class="dnr-wrap" :class="{ 'dnr-wrap--active': state.speechProcLevel != null }" @wheel.prevent="onProcLevelWheel">
          <StatusBadge label="PROC LEVEL" :value="state.speechProcLevel != null ? (state.speechProcLevel === 0 ? 'OFF' : String(state.speechProcLevel)) : '--'" />
        </div>
        <StatusBadge label="VOX" :value="state.vox != null ? (state.vox ? 'ON' : 'OFF') : '--'" :active="state.vox === true" color-active="#10b981" :clickable="state.vox !== null" :busy="voxBusy" @toggle="toggleVox" />
        <div class="dnr-wrap" :class="{ 'dnr-wrap--active': state.voxGain != null }" @wheel.prevent="onVoxGainWheel">
          <StatusBadge label="VOX GAIN" :value="state.voxGain != null ? String(state.voxGain) : '--'" />
        </div>
        <StatusBadge label="ATT" :value="state.rfAttenuator ? 'ON' : 'OFF'" :active="state.rfAttenuator" color-active="#f59e0b" :clickable="attClickable" :busy="attBusy" @toggle="toggleAtt" />
        <StatusBadge label="AMP HF/50MHz" :value="state.preAmpHf != null ? (['IPO','AMP1','AMP2'][state.preAmpHf] ?? '--') : '--'" :active="state.preAmpHf != null && state.preAmpHf > 0" color-active="#10b981" :clickable="state.preAmpHf !== null" :busy="preAmpBusy" @toggle="togglePreAmpHf" />
        <StatusBadge label="AMP VHF" :value="state.preAmpVhf != null ? (state.preAmpVhf ? 'ON' : 'OFF') : '--'" :active="state.preAmpVhf === true" color-active="#10b981" :clickable="state.preAmpVhf !== null" :busy="preAmpBusy" @toggle="togglePreAmpVhf" />
        <StatusBadge label="AMP UHF" :value="state.preAmpUhf != null ? (state.preAmpUhf ? 'ON' : 'OFF') : '--'" :active="state.preAmpUhf === true" color-active="#10b981" :clickable="state.preAmpUhf !== null" :busy="preAmpBusy" @toggle="togglePreAmpUhf" />
        <StatusBadge v-if="state.firmware?.spa1 !== null" label="HF ANT" :value="false ? 'ANT2' : 'ANT1'" :active="state.antSelect === 0" color-active="#a78bfa" :clickable="state.antSelect !== null" :busy="antSelectBusy" @toggle="toggleAntSelect1" />
        <StatusBadge v-if="state.firmware?.spa1 !== null" label="HF ANT" :value="true ? 'ANT2' : 'ANT1'" :active="state.antSelect === 1" color-active="#a78bfa" :clickable="state.antSelect !== null" :busy="antSelectBusy" @toggle="toggleAntSelect2" />
      </section>

      <!-- ── Bottom panels row ── -->
      <div class="bottom-panels">

        <!-- Scope panel -->
        <section class="scope-panel">
          <span class="scope-title">Band Scope {{ state.scopeSide === null ? '-' : state.scopeSide ? 'SUB' : 'MAIN' }}</span>

          <!-- LEVEL bar (bipolar: -30…+30, step 0.5) -->
          <div class="scope-level-row">
            <span class="scope-level-lbl">LEVEL</span>
            <div class="scope-level-track" @click="onScopeLevelClick">
              <div class="scope-level-center" />
              <div
                class="scope-level-fill"
                :style="scopeLevelFillStyle"
              />
            </div>
            <span class="scope-level-val">{{ scopeLevelDisplay }}</span>
          </div>

          <!-- SPAN + SPEED controls -->
          <div class="scope-controls">
            <div class="scope-btn-group">
              <span class="scope-group-lbl">SPAN</span>
              <button
                v-for="s in SCOPE_SPANS" :key="s.value"
                class="btn btn-xs scope-btn"
                :class="{ 'scope-btn--active': state.scope?.span === s.value }"
                @click="setScopeSpan(s.value)"
              >{{ s.label }}</button>
            </div>

            <div class="scope-sep" />

            <div class="scope-btn-group">
              <span class="scope-group-lbl">SPEED</span>
              <button
                v-for="s in SCOPE_SPEEDS" :key="s.value"
                class="btn btn-xs scope-btn"
                :class="{ 'scope-btn--active': state.scope?.speed === s.value }"
                @click="setScopeSpeed(s.value)"
              >{{ s.label }}</button>
            </div>
          </div>

          <div class="scope-controls">
            <div class="scope-btn-group">
              <span class="scope-group-lbl">MODE</span>
              <button
                v-for="m in SCOPE_MODES" :key="m.value"
                class="btn btn-xs scope-btn"
                :class="{ 'scope-btn--active': state.scope?.mode === m.value }"
                @click="setScopeMode(m.value)"
              >{{ m.label }}</button>
            </div>

            <div class="scope-sep" />

            <button
              class="btn btn-xs scope-btn scope-color-btn"
              @click="cycleScopeColor"
            >
              <span>{{ scopeColorLabel }}</span>
            </button>

            <div class="scope-sep" />

            <button
              class="btn btn-xs scope-btn scope-color-btn"
              :class="{ 'scope-btn--active': state.scope?.marker === true }"
              @click="toggleScopeMarker"
            >
              <span>MARKER {{ state.scope?.marker == null ? '--' : state.scope.marker ? 'ON' : 'OFF' }}</span>
            </button>
          </div>
        </section>

        <!-- Saved channels panel -->
        <section class="channels-panel">
          <div class="channels-header">
            <span class="scope-title">Saved Channels</span>
            <span class="channels-count" v-if="savedChannels.length > 0">{{ savedChannels.length }}</span>
          </div>
          <div class="channels-list" v-if="savedChannels.length > 0">
            <div
              v-for="ch in sortedChannels"
              :key="ch.id"
              class="ch-badge"
              :title="chSqlLabel(ch) ?? undefined"
              @click="applyChannel(ch)"
            >
              <span class="ch-freq">{{ chLabel(ch) }}</span>
              <span v-if="chSqlLabel(ch)" class="ch-sql">{{ chSqlLabel(ch) }}</span>
              <button class="ch-del" @click.stop="deleteChannel(ch.id)" title="Remove">×</button>
            </div>
          </div>
          <div v-else class="channels-empty">No saved channels</div>

          <!-- Save to radio row per saved channel -->
          <div v-if="savedChannels.length > 0" class="channels-write-row">
            <span class="channels-write-label">Write to radio slot:</span>
            <div class="channels-write-list">
              <div v-for="ch in sortedChannels" :key="ch.id" class="channels-write-item">
                <span class="ch-freq-sm">{{ (ch.freq / 1_000_000).toFixed(3) }}</span>
                <input
                  type="number" min="1" max="999" placeholder="slot"
                  class="slot-input"
                  :value="radioMemWriteSlots[ch.id]"
                  @input="radioMemWriteSlots[ch.id] = parseInt(($event.target as HTMLInputElement).value)"
                />
                <button
                  class="btn btn-sm"
                  :disabled="!radioMemWriteSlots[ch.id] || radioMemWriteSlots[ch.id] < 1"
                  @click="writeChannelToRadio(ch)"
                >→ Radio</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Radio memory panel -->
        <section class="channels-panel">
          <div class="channels-header">
            <span class="scope-title">Radio Memory</span>
            <span class="channels-count" v-if="sortedRadioChannels.length > 0">{{ sortedRadioChannels.length }}</span>
            <div class="radio-mem-scan">
              <input type="number" min="1" max="999" class="slot-input" v-model.number="radioMemScanFrom" />
              <span class="slot-sep">–</span>
              <input type="number" min="1" max="999" class="slot-input" v-model.number="radioMemScanTo" />
              <button class="btn btn-sm" :disabled="radioMemScanning || !state.connected" @click="scanRadioMemory">
                {{ radioMemScanning ? 'Scanning…' : 'Scan' }}
              </button>
            </div>
          </div>
          <div class="channels-list" v-if="sortedRadioChannels.length > 0">
            <div
              v-for="ch in sortedRadioChannels"
              :key="ch.slot"
              class="ch-badge"
              :title="`Slot ${ch.slot}`"
              @click="recallRadioChannel(ch)"
            >
              <span class="ch-freq">{{ radioChLabel(ch) }}</span>
              <span v-if="ch.tag" class="ch-sql">{{ ch.tag }}</span>
            </div>
          </div>
          <div v-else class="channels-empty">{{ state.connected ? 'Press Scan to read radio memory' : 'Connect to use radio memory' }}</div>
        </section>

        <!-- Presets panel -->
        <section v-if="presets.length > 0" class="presets-section">
          <div class="presets-header">
            <span class="section-title">Presets</span>
            <span class="presets-hint">Edit <code>cat-presets.json</code> to customize</span>
          </div>
          <div class="presets-grid">
            <PresetButton
              v-for="preset in presets"
              :key="preset.id"
              :preset="preset"
              :connected="state.connected"
              @executed="onPresetExecuted"
            />
          </div>
        </section>

      </div>

      <!-- ── Manual command input ── -->
      <section class="cmd-section">
        <span class="cmd-label">CAT Command:</span>
        <input
          v-model="manualCmd"
          class="cmd-input"
          placeholder="e.g. FA  or  MD01"
          @keydown.enter="sendManualCommand"
          spellcheck="false"
        />
        <button class="btn btn-primary btn-sm" @click="sendManualCommand">Send</button>
        <span class="cmd-response" v-if="manualResponse">→ {{ manualResponse }}</span>
      </section>

      </div><!-- end dashboard tab -->

      <!-- ── Channel List tab ── -->
      <div v-show="activeTab === 'channels'" class="channel-list-tab">

        <!-- Toolbar -->
        <div class="chlist-toolbar">
          <div class="chlist-scan-range">
            <span class="chlist-range-lbl">Slots</span>
            <input type="number" v-model.number="chListScanFrom" min="1" max="999" class="slot-input" />
            <span class="slot-sep">–</span>
            <input type="number" v-model.number="chListScanTo" min="1" max="999" class="slot-input" />
          </div>
          <button class="btn btn-primary btn-sm chlist-action-btn" :disabled="chListScanning" @click="readAllFromRadio">
            {{ chListScanning ? `Reading… ${chListScanDone}/${chListScanTotal}` : 'Read from Radio' }}
          </button>
          <button class="btn btn-sm chlist-action-btn" :disabled="chListWriting || (!chListDirtyCount && !chListWriting) || !state.connected" @click="writeAllToRadio">
            {{ chListWriting ? `Writing… ${chListWriteDone}/${chListWriteTotal}` : chListDirtyCount ? `Write to Radio (${chListDirtyCount})` : 'Write to Radio' }}
          </button>
          <div class="chlist-toolbar-sep" />
          <button class="btn btn-sm" @click="addNewChannel">+ Add Channel</button>
          <button class="btn btn-sm" @click="rsgbDialog = true">+ Add from RSGB</button>
          <button class="btn btn-sm" @click="exportCsv" :disabled="!channelListRows.length">Export CSV</button>
          <button class="btn btn-sm" @click="triggerImport">Import CSV</button>
          <input ref="csvImportRef" type="file" accept=".csv,text/csv" class="csv-hidden-input" @change="onImportCsv" />
          <span class="chlist-count" v-if="channelListRows.length">{{ channelListRows.length }} channels</span>
        </div>

        <!-- Table -->
        <div class="chlist-table-wrap">
          <table class="chlist-table" v-if="channelListRows.length">
            <thead>
              <tr>
                <th class="th-drag"></th>
                <th class="th-slot">Slot</th>
                <th class="th-freq">RX Freq (MHz)</th>
                <th class="th-freq">TX Freq (MHz)</th>
                <th class="th-split">Split</th>
                <th class="th-mode">Mode</th>
                <th class="th-sql">SQL Type</th>
                <th class="th-ctcss">CTCSS (Hz)</th>
                <th class="th-dcs">DCS</th>
                <th class="th-shift">Shift</th>
                <th class="th-tag">Tag / Name</th>
                <th class="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in channelListRows"
                :key="idx"
                :class="{
                  'row-dirty':     row.dirty,
                  'row-drag-over': dragOverIdx === idx && dragSrcIdx !== idx,
                }"
                draggable="true"
                @dragstart="onDragStart($event, idx)"
                @dragover="onDragOver($event, idx)"
                @dragend="onDragEnd"
                @drop="onDrop($event, idx)"
              >
                <td class="td-drag">⠿</td>
                <td class="td-slot-edit">
                  <input
                    type="number" min="1" max="999" class="cell-input cell-slot"
                    :value="row.slot"
                    @change="updateRowSlot(row, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="number" step="0.001" class="cell-input cell-freq"
                    :value="(row.freq / 1_000_000).toFixed(6)"
                    @change="updateRowFreq(row, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="number" step="0.001" class="cell-input cell-freq"
                    :value="row.txFreq !== null ? (row.txFreq / 1_000_000).toFixed(6) : ''"
                    :placeholder="(row.freq / 1_000_000).toFixed(3)"
                    @change="updateRowTxFreq(row, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="td-split">
                  <input
                    type="checkbox" class="cell-checkbox"
                    :checked="row.splitMem"
                    @change="row.splitMem = ($event.target as HTMLInputElement).checked; row.dirty = true"
                  />
                </td>
                <td>
                  <select class="cell-select" v-model="row.mode" @change="row.dirty = true">
                    <option v-for="m in MODES" :key="m.code" :value="m.label">{{ m.label }}</option>
                  </select>
                </td>
                <td>
                  <select class="cell-select" v-model.number="row.sqlType" @change="row.dirty = true">
                    <option :value="0">None</option>
                    <option :value="1">CTCSS ENC/DEC</option>
                    <option :value="2">CTCSS ENC</option>
                    <option :value="3">DCS</option>
                    <option :value="4">PR FREQ</option>
                    <option :value="5">REV TONE</option>
                  </select>
                </td>
                <td>
                  <select
                    class="cell-select cell-ctcss"
                    :disabled="row.sqlType < 1 || row.sqlType > 2"
                    v-model.number="row.ctcssIdx"
                    @change="row.dirty = true"
                  >
                    <option :value="null">—</option>
                    <option v-for="(hz, i) in CTCSS_TONES" :key="i" :value="i">{{ hz.toFixed(1) }}</option>
                  </select>
                </td>
                <td>
                  <select
                    class="cell-select cell-dcs"
                    :disabled="row.sqlType < 3 || row.sqlType > 4"
                    v-model.number="row.dcsIdx"
                    @change="row.dirty = true"
                  >
                    <option :value="null">—</option>
                    <option v-for="(code, i) in DCS_CODES" :key="i" :value="i">D{{ String(code).padStart(3, '0') }}</option>
                  </select>
                </td>
                <td>
                  <select class="cell-select" v-model.number="row.shift" :disabled="row.splitMem" @change="row.dirty = true">
                    <option :value="0">Simplex</option>
                    <option :value="1">+</option>
                    <option :value="2">−</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text" class="cell-input cell-tag" v-model="row.tag"
                    maxlength="12" @input="row.dirty = true"
                    :placeholder="(row.mode === 'C4FM-DN' || row.mode === 'C4FM-VW') ? 'YSF group…' : ''"
                  />
                </td>
                <td class="td-actions">
                  <button class="btn btn-xs" title="Copy to Main VFO" :disabled="!state.connected" @click="recallRadioChannel(row)">Copy to VFO</button>
                  <button class="btn btn-xs btn-ghost" title="Look up on RSGB" @click="openRepeaterInfo(row)">Info</button>
                  <button class="btn btn-xs btn-del" title="Delete row" @click="deleteChannelRow(idx)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="chlist-empty">
            Press "Read from Radio" to load channels, or "Add Channel" / "Import CSV" to start manually.
          </div>
        </div>
      </div><!-- end channel list tab -->

    </main>

    <!-- ── Not connected screen ── -->
    <div v-else class="idle-screen">
      <div class="idle-icon">📡</div>
      <p>Select a serial port and click <strong>Connect</strong> to start.</p>
      <p class="idle-hint">
        On macOS, FTX-1 appears as <code>/dev/cu.SLAB_USBtoUART</code> or similar.<br>
        Default baud rate: <strong>38400</strong> for CAT-1 and <strong>4800</strong> for CAT-2.
      </p>
    </div>

    <footer class="footer">
      <span>Yaesu FTX-1 · <span v-if="state.firmware.display">Display: {{ state.firmware.display }} · </span>
        <span v-if="state.firmware?.main">Main: {{ state.firmware.main }} · </span>
        <span v-if="state.firmware?.dsp">Dsp: {{ state.firmware.dsp }} · </span>
        <span v-if="state.firmware?.sdr">Sdr: {{ state.firmware.sdr }} · </span>
        <span v-if="state.firmware?.spa1">Opt: {{ state.firmware.spa1 }} · </span>
        <span v-if="state.firmware?.fc80">Fc80: {{ state.firmware.fc80 }} · </span> Last update: {{ lastUpdateTime }}</span>
    </footer>

    <!-- ── CTCSS tone picker modal (teleported to body) ── -->
    <Teleport to="body">
      <div
        v-if="ctcssPopupVfo !== null"
        class="tone-modal-backdrop"
        @click.self="closeCtcssPopup"
      >
        <div
          ref="ctcssDialogRef"
          class="tone-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="'CTCSS Tone — ' + (ctcssPopupVfo === '0' ? 'MAIN' : 'SUB')"
        >
          <div class="tone-modal-header">
            <span class="tone-modal-title">CTCSS Tone — {{ ctcssPopupVfo === '0' ? 'MAIN' : 'SUB' }}</span>
            <button class="tone-modal-close" @click="closeCtcssPopup" aria-label="Close">✕</button>
          </div>
          <div class="ctcss-tone-grid">
            <button
              v-for="(hz, idx) in CTCSS_TONES"
              :key="idx"
              class="ctcss-tone-btn"
              :class="{ 'ctcss-tone-btn--active': (ctcssPopupVfo === '0' ? state.mainCtcssTone : state.subCtcssTone) === idx }"
              @click="selectCtcssTone(ctcssPopupVfo, idx)"
            >{{ hz.toFixed(1) }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── DCS code picker modal (teleported to body) ── -->
    <Teleport to="body">
      <div
        v-if="dcsPopupVfo !== null"
        class="tone-modal-backdrop"
        @click.self="closeDcsPopup"
      >
        <div
          ref="dcsDialogRef"
          class="tone-modal tone-modal--dcs"
          role="dialog"
          aria-modal="true"
          :aria-label="'DCS Code — ' + (dcsPopupVfo === '0' ? 'MAIN' : 'SUB')"
        >
          <div class="tone-modal-header">
            <span class="tone-modal-title">DCS Code — {{ dcsPopupVfo === '0' ? 'MAIN' : 'SUB' }}</span>
            <button class="tone-modal-close" @click="closeDcsPopup" aria-label="Close">✕</button>
          </div>
          <div class="dcs-code-grid">
            <button
              v-for="(code, idx) in DCS_CODES"
              :key="idx"
              class="ctcss-tone-btn"
              :class="{ 'ctcss-tone-btn--active': (dcsPopupVfo === '0' ? state.mainDcsCode : state.subDcsCode) === idx }"
              @click="selectDcsCode(dcsPopupVfo, idx)"
            >D{{ String(code).padStart(3, '0') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Mode picker modal (teleported to body) ── -->
    <Teleport to="body">
      <div
        v-if="modePopupVfo !== null"
        class="tone-modal-backdrop"
        @click.self="closeModePopup"
      >
        <div
          ref="modeDialogRef"
          class="tone-modal mode-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="'Mode — ' + (modePopupVfo === '0' ? 'MAIN' : 'SUB')"
        >
          <div class="tone-modal-header">
            <span class="tone-modal-title">Mode — {{ modePopupVfo === '0' ? 'MAIN' : 'SUB' }}</span>
            <button class="tone-modal-close" @click="closeModePopup" aria-label="Close">✕</button>
          </div>
          <div class="mode-btn-grid">
            <button
              v-for="m in MODES"
              :key="m.code"
              class="mode-modal-btn"
              :style="modeBadgeStyle(m.label)"
              :class="{ 'mode-modal-btn--active': (modePopupVfo === '0' ? state.mainMode : state.subMode) === m.label }"
              @click="selectModeFromPopup(modePopupVfo, m.label)"
            >{{ m.label }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Band picker modal (teleported to body) ── -->
    <Teleport to="body">
      <div
        v-if="bandPopupVfo !== null"
        class="tone-modal-backdrop"
        @click.self="closeBandPopup"
      >
        <div
          ref="bandDialogRef"
          class="tone-modal band-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="'Band — ' + (bandPopupVfo === '0' ? 'MAIN' : 'SUB')"
        >
          <div class="tone-modal-header">
            <span class="tone-modal-title">Band — {{ bandPopupVfo === '0' ? 'MAIN' : 'SUB' }}</span>
            <button class="tone-modal-close" @click="closeBandPopup" aria-label="Close">✕</button>
          </div>
          <div class="band-btn-grid">
            <button
              v-for="b in BANDS"
              :key="b.code"
              class="band-modal-btn"
              :class="{ 'band-modal-btn--active': (bandPopupVfo === '0' ? mainBandCode : subBandCode) === b.code }"
              @click="selectBandFromPopup(bandPopupVfo, b.code)"
            >{{ b.label }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── RSGB repeater import dialog ── -->
    <Teleport to="body">
      <div v-if="rsgbDialog" class="rsgb-backdrop" @click.self="rsgbDialog = false">
        <div class="rsgb-modal" role="dialog" aria-modal="true" aria-label="Add from RSGB">

          <div class="rsgb-header">
            <span class="rsgb-title">Add from RSGB Repeater List</span>
            <button class="tone-modal-close" @click="rsgbDialog = false" aria-label="Close">✕</button>
          </div>

          <div class="rsgb-mode-note">Only SSB, AM, FM and C4FM modes are supported by the Yaesu FTX-1. Greyed out entries use unsupported modes.</div>

          <div class="rsgb-search-row">
            <select v-model="rsgbSearchType" class="sel rsgb-type-sel">
              <option value="band">Band</option>
              <option value="callsign">Callsign</option>
              <option value="locator">Locator</option>
            </select>
            <select v-if="rsgbSearchType === 'band'" v-model="rsgbSearchQuery" class="rsgb-query-input rsgb-band-sel">
              <option value="">Select band…</option>
              <option value="10m">10m</option>
              <option value="6m">6m</option>
              <option value="4m">4m</option>
              <option value="2m">2m</option>
              <option value="70cm">70cm</option>
              <option value="23cm">23cm</option>
              <option value="13cm">13cm</option>
            </select>
            <input
              v-else
              type="text" v-model="rsgbSearchQuery" class="rsgb-query-input"
              :placeholder="rsgbSearchType === 'callsign' ? 'GB3XYZ…' : 'IO91WM or IO91…'"
              :style="rsgbSearchType === 'locator' ? 'text-transform:uppercase' : ''"
              @input="rsgbSearchQuery = rsgbSearchType === 'locator' ? String(rsgbSearchQuery).toUpperCase() : rsgbSearchQuery"
              @keydown.enter="fetchRsgb"
            />
            <button class="btn btn-primary btn-sm" :disabled="rsgbLoading || !rsgbSearchQuery.trim()" @click="fetchRsgb">
              {{ rsgbLoading ? 'Searching…' : 'Search' }}
            </button>
          </div>

          <div v-if="rsgbError" class="rsgb-error">{{ rsgbError }}</div>

          <div v-if="!rsgbLoading && rsgbResults.length" class="rsgb-summary">
            {{ rsgbResults.length }} found —
            <strong>{{ rsgbSelected.size }} selected</strong>
            ({{ rsgbSelectedChannelCount }} channels)
          </div>
          <div v-else-if="!rsgbLoading && !rsgbError && rsgbSearchQuery && rsgbResults.length === 0 && !rsgbLoading" class="rsgb-no-match">
            No entries found.
          </div>

          <div v-if="rsgbResults.length" class="rsgb-table-wrap">
            <table class="rsgb-table">
              <thead>
                <tr>
                  <th class="th-rsgb-chk">
                    <input
                      type="checkbox"
                      class="cell-checkbox"
                      :checked="rsgbAllEligibleSelected"
                      @change="rsgbToggleAll(($event.target as HTMLInputElement).checked)"
                    />
                  </th>
                  <th>Callsign</th>
                  <th>Town</th>
                  <th>Locator</th>
                  <th>Band</th>
                  <th>Listen (MHz)</th>
                  <th>TX to (MHz)</th>
                  <th>CTCSS</th>
                  <th>Modes</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="e in rsgbResults" :key="e.id"
                  :class="{ 'rsgb-row-ineligible': !e.modeCodes.includes('A') && !e.modeCodes.includes('F') }"
                >
                  <td class="td-rsgb-chk">
                    <input
                      type="checkbox"
                      class="cell-checkbox"
                      :checked="rsgbSelected.has(e.id)"
                      :disabled="!e.modeCodes.includes('A') && !e.modeCodes.includes('F')"
                      @change="rsgbToggleEntry(e.id, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td>{{ e.repeater }}</td>
                  <td>{{ e.town }}</td>
                  <td>{{ e.locator }}</td>
                  <td>{{ e.band }}</td>
                  <td>{{ (e.tx / 1_000_000).toFixed(4) }}</td>
                  <td>{{ (e.rx / 1_000_000).toFixed(4) }}</td>
                  <td>{{ e.ctcss > 0 ? e.ctcss.toFixed(1) : '—' }}</td>
                  <td>{{ e.modeCodes.join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="rsgbResults.length" class="rsgb-import-row">
            <label class="rsgb-import-label">Add from slot:</label>
            <input type="number" v-model.number="rsgbAddFromSlot" min="1" max="999" class="slot-input" />
            <label class="rsgb-import-check">
              <input type="checkbox" v-model="rsgbOverwrite" />
              Overwrite existing
            </label>
            <div class="rsgb-import-spacer" />
            <button class="btn btn-sm" @click="rsgbDialog = false">Cancel</button>
            <button class="btn btn-primary btn-sm" :disabled="!rsgbSelectedChannelCount" @click="importRsgbChannels">
              Add {{ rsgbSelectedChannelCount }} channels
            </button>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ── Repeater info dialog ── -->
    <Teleport to="body">
      <div v-if="repInfoDialog" class="rsgb-backdrop" @click.self="repInfoDialog = false">
        <div class="repinfo-modal" role="dialog" aria-modal="true">

          <div class="rsgb-header">
            <span class="rsgb-title">
              Repeater Info
              <span v-if="repInfoCallsign" class="repinfo-callsign">— {{ repInfoCallsign.toUpperCase() }}</span>
            </span>
            <button class="tone-modal-close" @click="repInfoDialog = false" aria-label="Close">✕</button>
          </div>

          <div v-if="repInfoLoading" class="repinfo-loading">Searching…</div>
          <div v-else-if="repInfoError" class="rsgb-error">{{ repInfoError }}</div>
          <div v-else class="repinfo-list">
            <div v-for="e in repInfoResults" :key="e.id" class="repinfo-card">
              <div class="repinfo-card-header">
                <span class="repinfo-rptr">{{ e.repeater }}</span>
                <span class="repinfo-status" :class="repStatusClass(e.status)">{{ e.status }}</span>
                <a
                  :href="`https://ukrepeater.net/my_repeater.php?id=${e.id}`"
                  target="_blank" rel="noopener"
                  class="btn btn-xs btn-ghost repinfo-link"
                >ukrepeater.net ↗</a>
              </div>
              <table class="repinfo-table">
                <tr>
                  <td>Town</td><td>{{ e.town }}</td>
                  <td>Keeper</td><td>{{ e.keeperCallsign }}</td>
                </tr>
                <tr>
                  <td>Band</td><td>{{ e.band }}</td>
                  <td>Locator</td><td>{{ e.locator }}</td>
                </tr>
                <tr>
                  <td>Listen (MHz)</td><td>{{ (e.tx / 1_000_000).toFixed(4) }}</td>
                  <td>TX to (MHz)</td><td>{{ (e.rx / 1_000_000).toFixed(4) }}</td>
                </tr>
                <tr>
                  <td>CTCSS</td><td>{{ e.ctcss > 0 ? `${e.ctcss} Hz` : '—' }}</td>
                  <td>Modes</td><td>{{ e.modeCodes.join(', ') }}</td>
                </tr>
              </table>
            </div>
          </div>

        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSerial, type TransceiverState, type CommandResult, type RadioChannel } from '~/composables/useSerial'
import presetsData from '~/cat-presets.json'
import SMeter from '~/components/SMeter.vue'
import LevelBar from '~/components/LevelBar.vue'
import StatusBadge from '~/components/StatusBadge.vue'
import PresetButton from '~/components/PresetButton.vue'

// ----------- state -----------
interface ChannelConfig {
  id: string
  freq: number
  mode: string | null
  sqlType: number | null
  ctcssIdx: number | null
  dcsIdx: number | null
}

interface Preset {
  id: string
  label: string
  color?: string
  icon?: string
  description?: string
  commands: string[]
}

interface CommandResult {
  command: string
  response?: string
  error?: string
  ok: boolean
}

const { state, connecting, isSupported, connect, disconnect, send, sendPreset, getKnownPorts, readMemoryChannel, scanMemoryChannels, writeMemoryChannel } = useSerial()
const appVersion      = useRuntimeConfig().public.appVersion
const selectedBaud    = ref(38400)
const knownPorts      = ref<any[]>([])
const selectedPortIdx = ref(-1)
const lastError = ref<string | null>(null)
const manualCmd = ref('')
const manualResponse = ref('')
const presets = ref<Preset[]>([])
const funcKnobBusy = ref(false)
const speechProcBusy = ref(false)
const voxBusy = ref(false)
const preAmpBusy    = ref(false)
const antSelectBusy = ref(false)
const rxModeBusy = ref(false)
const splitBusy = ref(false)
const activeTab = ref<'dashboard' | 'channels'>('dashboard')
const savedChannels = ref<ChannelConfig[]>([])
const radioMemScanFrom = ref(1)
const radioMemScanTo   = ref(99)
const radioMemScanning = ref(false)
const radioMemWriteSlots = ref<Record<string, number>>({})

interface EditableChannel {
  slot: number
  freq: number          // RX frequency Hz
  txFreq: number | null // TX frequency Hz; null = same as RX
  splitMem: boolean
  mode: string
  sqlType: number
  ctcssIdx: number | null
  dcsIdx: number | null
  clarDir: string       // '+' or '-'
  clarOffset: number    // Hz 0-9990
  rxClar: boolean
  txClar: boolean
  shift: number
  tag: string
  dirty: boolean
}
const channelListRows = ref<EditableChannel[]>([])
const chListScanning  = ref(false)
const chListWriting   = ref(false)
const chListScanDone  = ref(0)
const chListScanTotal = ref(0)
const chListWriteDone = ref(0)
const chListWriteTotal = ref(0)
const chListScanFrom  = ref(1)
const chListScanTo    = ref(999)
const dragSrcIdx      = ref<number | null>(null)
const dragOverIdx     = ref<number | null>(null)
const csvImportRef    = ref<HTMLInputElement | null>(null)

interface RsgbEntry {
  id: number
  type: string
  status: string
  keeperCallsign: string
  town: string
  modeCodes: string[]
  tx: number
  rx: number
  ctcss: number
  txbw: number
  band: string
  locator: string
  repeater: string
}
const rsgbDialog      = ref(false)
const rsgbSearchType  = ref<'band' | 'callsign' | 'locator'>('band')
const rsgbSearchQuery = ref('')
const rsgbResults     = ref<RsgbEntry[]>([])
const rsgbLoading     = ref(false)
const rsgbError       = ref<string | null>(null)
const rsgbAddFromSlot = ref(1)
const rsgbOverwrite   = ref(false)
const repInfoDialog   = ref(false)
const repInfoLoading  = ref(false)
const repInfoResults  = ref<RsgbEntry[]>([])
const repInfoError    = ref<string | null>(null)
const repInfoCallsign = ref('')

function loadChannels() {
  try {
    const raw = localStorage.getItem('cat_channels')
    savedChannels.value = raw ? JSON.parse(raw) : []
  } catch { savedChannels.value = [] }
}
function persistChannels() {
  localStorage.setItem('cat_channels', JSON.stringify(savedChannels.value))
}
const moxBusy = ref(false)
const txVfoBusy = ref(false)
const lockBusy   = ref(false)
const narrowBusy = ref(false)
const agcBusy    = ref(false)

// ----------- computed -----------

const lastUpdateTime = computed(() => {
  if (!state.value.connected) return '--'
  const d = new Date(state.value.lastUpdate)
  return d.toLocaleTimeString()
})

const speechProcLabel = computed(() => {
  if (state.value.speechProc === null) return '--'
  return state.value.speechProc ? 'ON' : 'OFF'
})

// ----------- band data -----------

const BANDS = [
  { code: '00', label: '1.8 MHz',   freqMin:   1_800_000, freqMax:   2_000_000 },
  { code: '01', label: '3.5 MHz',   freqMin:   3_500_000, freqMax:   4_000_000 },
  { code: '02', label: '5 MHz',     freqMin:   5_000_000, freqMax:   5_500_000 },
  { code: '03', label: '7 MHz',     freqMin:   7_000_000, freqMax:   7_300_000 },
  { code: '04', label: '10 MHz',    freqMin:  10_000_000, freqMax:  10_200_000 },
  { code: '05', label: '14 MHz',    freqMin:  14_000_000, freqMax:  14_400_000 },
  { code: '06', label: '18 MHz',    freqMin:  18_000_000, freqMax:  18_200_000 },
  { code: '07', label: '21 MHz',    freqMin:  21_000_000, freqMax:  21_500_000 },
  { code: '08', label: '24.5 MHz',  freqMin:  24_500_000, freqMax:  25_000_000 },
  { code: '09', label: '28 MHz',    freqMin:  28_000_000, freqMax:  30_000_000 },
  { code: '10', label: '50 MHz',    freqMin:  50_000_000, freqMax:  54_000_000 },
  { code: '11', label: '70 MHz/GEN',freqMin:  70_000_000, freqMax: 108_000_000 },
  { code: '12', label: 'AIR',       freqMin: 108_000_000, freqMax: 144_000_000 },
  { code: '13', label: '144 MHz',   freqMin: 144_000_000, freqMax: 148_000_000 },
  { code: '14', label: '430 MHz',   freqMin: 430_000_000, freqMax: 450_000_000 },
] as const

function freqToBandCode(hz: number | null): string | null {
  if (!hz) return null
  return BANDS.find(b => hz >= b.freqMin && hz < b.freqMax)?.code ?? null
}

const mainBandCode = computed(() => freqToBandCode(state.value.mainFreq))
const subBandCode  = computed(() => freqToBandCode(state.value.subFreq))

const bandBusy = ref(false)
const sqlTypeBusy = ref(false)
const attBusy = ref(false)
const attClickable = computed(() =>
  (state.value.mainFreq != null && state.value.mainFreq < 75000000) ||
  (state.value.subFreq  != null && state.value.subFreq  < 75000000)
)

async function selectBand(vfo: '0' | '1', code: string) {
  if (bandBusy.value || !code) return
  bandBusy.value = true
  try {
    // BS P1 P2 P2 ; — P1=0 main / 1 sub, P2P2=2-digit band code (zero-padded)
    // Do NOT assign state here — BS uses sendCommandNoWait so the returned state
    // is pre-command (stale). The real update arrives via SSE after the transceiver
    // processes the command.
    await send(`BS${vfo}${code}`)
    if (state.value.firmware?.spa1 !== null) {
      await send('EX030704')
    }
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    bandBusy.value = false
  }
}

async function sendUp() {
  if (bandBusy.value) return
  bandBusy.value = true
  try {
    await send('UP')
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    bandBusy.value = false
  }
}

async function sendDn() {
  if (bandBusy.value) return
  bandBusy.value = true
  try {
    await send('DN')
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    bandBusy.value = false
  }
}

// ----------- CTCSS / DCS lookup -----------

/** CTCSS tone frequencies (Hz) indexed 0–49, per FTX-1 Table 1 */
const CTCSS_TONES: readonly number[] = [
   67.0,  69.3,  71.9,  74.4,  77.0,  79.7,  82.5,  85.4,  88.5,  91.5,
   94.8,  97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
  131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
  171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5,
  203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1,
]

/** DCS codes indexed 0–103, per FTX-1 Table 2 */
const DCS_CODES: readonly number[] = [
   23,  25,  26,  31,  32,  36,  43,  47,  51,  53,  54,  65,  71,  72,  73,
   74, 114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162,
  165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252, 255,
  261, 263, 265, 266, 271, 274, 306, 311, 315, 325, 331, 332, 343, 346, 351,
  356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446, 452, 454, 455,
  462, 464, 465, 466, 503, 506, 516, 523, 526, 532, 546, 565, 606, 612, 624,
  627, 631, 632, 654, 662, 664, 703, 712, 723, 731, 732, 734, 743, 754,
]

const SQL_TYPE_LABELS: Record<number, string> = {
  0: 'OFF', 1: 'CTCSS ENC', 2: 'CTCSS SQL', 3: 'DCS', 4: 'PR FREQ', 5: 'REV TONE',
}

const SQL_RFG_MODE_LABELS: Record<number, string> = {
  0: 'RF', 1: 'SQL', 2: 'SQL FM',
}

const SQL_TYPE_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#22d3ee', 2: '#22d3ee',   // CTCSS — cyan
  3: '#a78bfa',                  // DCS   — purple
  4: '#f59e0b', 5: '#f59e0b',   // special — amber
}

const FM_MODES = new Set(['FM', 'FM-N', 'DATA-FM', 'DATA-FM-N', 'C4FM-DN', 'C4FM-VW', 'AMS'])

function isFmMode(mode: string | null): boolean {
  return mode != null && FM_MODES.has(mode)
}

const DNR_MODES = new Set(['USB', 'LSB', 'CW-U', 'CW-L', 'AM', 'AM-N', 'DATA-L', 'DATA-U', 'PSK', 'RTTY-L', 'RTTY-U'])

function isDnrMode(mode: string | null): boolean {
  return mode != null && DNR_MODES.has(mode)
}

const DNR_MIN = 0
const DNR_MAX = 10

async function onPwrWheel(event: WheelEvent) {
  if (state.value.powerLevel == null) return
  const next = Math.max(5, Math.min(state.value.firmware?.spa1 === null ? 10 : 100, state.value.powerLevel + (event.deltaY < 0 ? 1 : -1)))
  const typePwr = state.value.firmware?.spa1 === null ? '1' : '2'

  if (next === state.value.powerLevel) return
  try {
    await send(`PC${typePwr}${String(next).padStart(3, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function onProcLevelWheel(event: WheelEvent) {
  if (state.value.speechProcLevel == null) return
  const next = Math.max(0, Math.min(100, state.value.speechProcLevel + (event.deltaY < 0 ? 1 : -1)))
  if (next === state.value.speechProcLevel) return
  try {
    await send(`PL${String(next).padStart(3, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function onAmcWheel(event: WheelEvent) {
  if (state.value.amcLevel == null) return
  const next = Math.max(1, Math.min(100, state.value.amcLevel + (event.deltaY < 0 ? 1 : -1)))
  if (next === state.value.amcLevel) return
  try {
    await send(`AO${String(next).padStart(3, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function onVoxGainWheel(event: WheelEvent) {
  if (state.value.voxGain == null) return
  const next = Math.max(0, Math.min(100, state.value.voxGain + (event.deltaY < 0 ? 1 : -1)))
  if (next === state.value.voxGain) return
  try {
    await send(`VG${String(next).padStart(3, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function onMicGainWheel(event: WheelEvent) {
  if (state.value.micGain == null) return
  const next = Math.max(0, Math.min(100, state.value.micGain + (event.deltaY < 0 ? 1 : -1)))
  if (next === state.value.micGain) return
  try {
    await send(`MG${String(next).padStart(3, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function onDnrWheel(vfo: '0' | '1', event: WheelEvent) {
  const mode = vfo === '0' ? state.value.mainMode : state.value.subMode
  if (!isDnrMode(mode)) return
  const raw = vfo === '0' ? state.value.dnrMain : state.value.dnrSub
  const current = (raw == null || raw === 'OFF') ? 0 : Number(raw)
  const next = Math.max(DNR_MIN, Math.min(DNR_MAX, current + (event.deltaY < 0 ? 1 : -1)))
  if (next === current) return
  try {
    await send(`RL${vfo}${String(next).padStart(2, '0')}`)
  } catch (e: any) {
    lastError.value = e.message
  }
}

async function setBandwidth(vfo: '0' | '1', idx: number) {
  try {
    await send(`SH${vfo}0${String(idx).padStart(2, '0')}`)
  } catch (e: any) { lastError.value = e.message }
}

async function setShift(vfo: '0' | '1', val: number) {
  try {
    const sign = val >= 0 ? '+' : '-';
    const abs = Math.abs(val).toFixed(0).padStart(4, '0');
    await send(`IS${vfo}0${sign}${abs}`)
  } catch (e: any) { lastError.value = e.message }
}

const RF_GAIN_MODES = new Set(['LSB', 'USB', 'CW-U', 'CW-L', 'RTTY-L', 'RTTY-U', 'DATA-L', 'DATA-U', 'PSK'])

function isRfGainMode(mode: string | null): boolean {
  return mode != null && RF_GAIN_MODES.has(mode)
}

// ── Band Scope (SS command) ─────────────────────────────

const SCOPE_SPANS = [
//  { value: 0, label: '-' },
//  { value: 1, label: '-' },
  { value: 2, label: '5k' },
  { value: 3, label: '10k' },
  { value: 4, label: '20k' },
  { value: 5, label: '50k' },
  { value: 6, label: '100k' },
  { value: 7, label: '200k' },
  { value: 8, label: '500k' },
  { value: 9, label: '1M' },
] as const

const SCOPE_SPEEDS = [
  { value: 0, label: 'SLOW1' },
  { value: 1, label: 'SLOW2' },
  { value: 2, label: 'FAST1' },
  { value: 3, label: 'FAST2' },
  { value: 4, label: 'FAST3' },
  { value: 5, label: 'STOP' },
] as const

const SCOPE_MODES = [
  { value: 0, label: '3DSS CTR' },
  { value: 1, label: '3DSS CUR' },
  { value: 2, label: '3DSS FIX' },
  { value: 3, label: 'W/F CTR' },
  { value: 6, label: 'W/F CUR' },
  { value: 9, label: 'W/F FIX' },
] as const

// Level: encoded 0-120 where 60=0.0, step=0.5 dB
const scopeLevelDisplay = computed(() => {
  const l = state.value.scope?.level
  if (l == null) return '--'
  else return l
})

const scopeLevelFillStyle = computed(() => {
  const l = state.value.scope?.level ?? 60
  const center = 50 // %
  const pct = ((l - 0) / 30) * 50 // -50..+50 %
  if (pct >= 0) return { left: center + '%', width: pct + '%', background: 'linear-gradient(90deg,#f59e0b,#fcd34d)' }
  return { left: (center + pct) + '%', width: (-pct) + '%', background: 'linear-gradient(270deg,#f59e0b,#fcd34d)' }
})

function buildScopeLevelCmd(overrides: { level?: number }): string {
  const s = state.value.scope
  const level = overrides.level ?? s?.level ?? 15
  const result = (level * 0.5) - 30;
  const sign = result >= 0 ? '+' : '-';
  const abs = Math.abs(result).toFixed(1).padStart(4, '0');
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  return `SS${side}4${sign}${abs}`
}

function buildScopeSpanCmd(overrides: { span?: number }): string {
  const s = state.value.scope
  const span = overrides.span ?? s?.span ?? 0
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  return `SS${side}5${span}0000`
}

function buildScopeSpeedCmd(overrides: { speed?: number }): string {
  const s = state.value.scope
  const speed = overrides.speed ?? s?.speed ?? 0
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  return `SS${side}0${speed}0000`
}

function onScopeLevelClick(e: MouseEvent) {
  const track = e.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const level = Math.round(pct * 120)
  send(buildScopeLevelCmd({ level })).catch((e: any) => { lastError.value = e.message })
}

function setScopeSpan(span: number) {
  send(buildScopeSpanCmd({ span })).catch((e: any) => { lastError.value = e.message })
}

function setScopeSpeed(speed: number) {
  send(buildScopeSpeedCmd({ speed })).catch((e: any) => { lastError.value = e.message })
}

function buildScopeModeCmd(overrides: { mode?: number }): string {
  const s = state.value.scope
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  const mode = overrides.mode ?? s?.mode ?? 0
  return `SS${side}6${mode}0000`
}

function setScopeMode(mode: number) {
  send(buildScopeModeCmd({ mode })).catch((e: any) => { lastError.value = e.message })
}

// COLOR: values 0–10 (0x0–0xA), labels COLOR 1–COLOR 11
const SCOPE_COLOR_MAX = 10

const scopeColorLabel = computed(() => {
  const c = state.value.scope?.color
  return c != null ? `COLOR ${c + 1}` : '--'
})

function cycleScopeColor() {
  const current = state.value.scope?.color ?? 0
  const next = current >= SCOPE_COLOR_MAX ? 0 : current + 1
  const hex = next.toString(16).toUpperCase()   // 0–9, A
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  send(`SS${side}3${hex}0000`).catch((e: any) => { lastError.value = e.message })
}

function toggleScopeMarker() {
  //if (state.value.scope?.marker === null) return
  const next = state.value.scope?.marker ? '0' : '1'   // 0=OFF, 1=ON
  const side = state.value.scopeSide === null ? '0' : state.value.scopeSide? '1': '0';
  send(`SS${side}2${next}0000`).catch((e: any) => { lastError.value = e.message })
}

/** Human-readable SQL type label */
function sqlTypeLabel(type: number | null): string {
  return type != null ? (SQL_TYPE_LABELS[type] ?? String(type)) : '--'
}

/** CSS color for the SQL type badge */
function sqlTypeColor(type: number | null): string {
  return type != null ? (SQL_TYPE_COLORS[type] ?? '#6b7280') : '#6b7280'
}

/**
 * Returns the tone/code string to display next to the SQL type.
 * For CTCSS: "127.3 Hz"; for DCS: "D156"; for type 0 (OFF): null.
 */
function toneDisplay(
  sqlType: number | null,
  ctcssTone: number | null,
  dcsCode: number | null,
): string | null {
  if (sqlType === null || sqlType === 0) return null
  if (sqlType === 3) {
    // DCS
    if (dcsCode === null || dcsCode < 0 || dcsCode >= DCS_CODES.length) return null
    return `D${String(DCS_CODES[dcsCode]).padStart(3, '0')}`
  }
  // CTCSS (types 1, 2, 4, 5) — type 4/5 may also use the stored CTCSS tone
  if (ctcssTone !== null && ctcssTone >= 0 && ctcssTone < CTCSS_TONES.length) {
    return `${CTCSS_TONES[ctcssTone].toFixed(1)} Hz`
  }
  return null
}

// ----------- helpers -----------

function formatFreq(hz: number | null): string {
  if (hz == null) return '---.---.---'
  const mhz = hz / 1_000_000
  // Format as XXX.XXX.XXX
  const [intPart, decPart = ''] = mhz.toFixed(6).split('.')
  const d = decPart.padEnd(6, '0')
  return `${intPart.padStart(3, ' ')}.${d.slice(0, 3)}.${d.slice(3)}`
}

/** Split frequency in Hz into three 3-digit display groups: [MHz, kHz, Hz] */
function freqGroups(hz: number | null): [string, string, string] {
  if (hz == null) return ['---', '---', '---']
  const h = Math.max(0, Math.round(hz))
  const mhz = Math.floor(h / 1_000_000)
  const khz = Math.floor((h % 1_000_000) / 1_000)
  const hz3 = h % 1_000
  return [
    String(mhz).padStart(3, '\u00a0'),  // non-breaking space → right-aligned in monospace
    String(khz).padStart(3, '0'),
    String(hz3).padStart(3, '0'),
  ]
}

const FREQ_STEP_MHZ = 1_000_000
const FREQ_STEP_HZ  = 100
const FREQ_MIN      = 100_000       // 100 kHz
const FREQ_MAX      = 999_999_999   // ~999 MHz

async function onFreqWheel(vfo: '0' | '1', groupIdx: number, event: WheelEvent) {
  const current = vfo === '0' ? state.value.mainFreq : state.value.subFreq
  if (current == null) return
  const direction = event.deltaY < 0 ? 1 : -1
  const mode = vfo === '0' ? state.value.mainMode : state.value.subMode
  const khzStep = mode != null && FM_MODES.has(mode) ? 5_000 : 1_000
  const step = groupIdx === 0 ? FREQ_STEP_MHZ : groupIdx === 1 ? khzStep : FREQ_STEP_HZ
  const newFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, current + direction * step))
  if (newFreq === current) return
  const cmd = (vfo === '0' ? 'FA' : 'FB') + String(newFreq).padStart(9, '0')
  try {
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  }
}

const MODE_COLORS: Record<string, string> = {
  LSB: '#3b82f6',
  USB: '#8b5cf6',
  'CW-U': '#f59e0b',
  'CW-L': '#f59e0b',
  FM: '#10b981',
  'FM-N': '#10b981',
  AM: '#ef4444',
  'AM-N': '#ef4444',
  'RTTY-L': '#ec4899',
  'RTTY-U': '#ec4899',
  'DATA-L': '#06b6d4',
  'DATA-U': '#06b6d4',
  PSK: '#a78bfa',
  'C4FM-DN': '#34d399',
  'C4FM-VW': '#34d399',
}

function modeBadgeStyle(mode: string | null) {
  const color = mode ? (MODE_COLORS[mode] ?? '#6b7280') : '#6b7280'
  return { background: color }
}

// MD command mode list: { code: CAT hex char, label: mode name }
const MODES = [
  { code: '0', label: 'AMS' },
  { code: '1', label: 'LSB' },
  { code: '2', label: 'USB' },
  { code: '3', label: 'CW-U' },
  { code: '7', label: 'CW-L' },
  { code: '5', label: 'AM' },
  { code: 'D', label: 'AM-N' },
  { code: '4', label: 'FM' },
  { code: 'B', label: 'FM-N' },
  { code: '6', label: 'RTTY-L' },
  { code: '9', label: 'RTTY-U' },
  { code: '8', label: 'DATA-L' },
  { code: 'C', label: 'DATA-U' },
  { code: 'A', label: 'DATA-FM' },
  { code: 'F', label: 'DATA-FM-N' },
  { code: 'E', label: 'PSK' },
  { code: 'H', label: 'C4FM-DN' },
  { code: 'I', label: 'C4FM-VW' },
] as const

const modeBusy = ref(false)

// Modes that carry an implicit Narrow flag (NA=1); all others → NA=0
const NARROW_MODES = new Set(['FM-N', 'AM-N', 'DATA-FM-N'])

async function selectMode(vfo: '0' | '1', label: string) {
  if (modeBusy.value || !label) return
  const entry = MODES.find(m => m.label === label)
  if (!entry) return
  modeBusy.value = true
  try {
    // MD P1 P2 ; — P1=0 main / 1 sub, P2=mode code
    await send(`MD${vfo}${entry.code}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    modeBusy.value = false
  }
}

// ── Band picker modal ────────────────────────────────────

const bandPopupVfo  = ref<'0' | '1' | null>(null)
const bandDialogRef = ref<HTMLElement | null>(null)

function openBandPopup(vfo: '0' | '1') {
  bandPopupVfo.value = vfo
  nextTick(() => {
    const dialog = bandDialogRef.value
    if (!dialog) return
    const active = dialog.querySelector<HTMLElement>('.band-modal-btn--active')
    const first  = dialog.querySelector<HTMLElement>('.band-modal-btn')
    ;(active ?? first)?.focus()
  })
}

function closeBandPopup() {
  bandPopupVfo.value = null
}

async function selectBandFromPopup(vfo: '0' | '1', code: string) {
  closeBandPopup()
  await selectBand(vfo, code)
}

// ── Mode picker modal ────────────────────────────────────

const modePopupVfo  = ref<'0' | '1' | null>(null)
const modeDialogRef = ref<HTMLElement | null>(null)

function openModePopup(vfo: '0' | '1') {
  modePopupVfo.value = vfo
  nextTick(() => {
    const dialog = modeDialogRef.value
    if (!dialog) return
    const active = dialog.querySelector<HTMLElement>('.mode-modal-btn--active')
    const first  = dialog.querySelector<HTMLElement>('.mode-modal-btn')
    ;(active ?? first)?.focus()
  })
}

function closeModePopup() {
  modePopupVfo.value = null
}

async function selectModeFromPopup(vfo: '0' | '1', label: string) {
  closeModePopup()
  await selectMode(vfo, label)
}

// ----------- API calls -----------

async function toggleConnection() {
  if (state.value.connected) {
    try {
      await disconnect()
    } catch (e: any) {
      lastError.value = e.message
    }
  } else {
    if (!isSupported) {
      lastError.value = 'Web Serial API not supported — please use Chrome or Edge.'
      return
    }
    try {
      localStorage.setItem('cat_baud', String(selectedBaud.value))
      const port = selectedPortIdx.value >= 0 ? knownPorts.value[selectedPortIdx.value] : undefined
      if (port) {
        const info = port.getInfo?.() ?? {}
        if (info.usbVendorId != null)
          localStorage.setItem('cat_port_vid_pid', `${info.usbVendorId}:${info.usbProductId}`)
      }
      await connect(selectedBaud.value, port)
      knownPorts.value = await getKnownPorts()
    } catch (e: any) {
      if ((e as DOMException).name !== 'NotFoundError') {
        lastError.value = e.message ?? 'Connection failed'
      }
    }
  }
}

const USB_SERIAL_NAMES: Record<string, string> = {
  '10c4:ea60': 'Silicon Labs CP2102',
  '10c4:ea61': 'Silicon Labs CP2102N',
  '10c4:ea70': 'Silicon Labs CP2105',
  '10c4:eac9': 'Silicon Labs CP2108',
  '0403:6001': 'FTDI FT232R',
  '0403:6010': 'FTDI FT2232',
  '0403:6011': 'FTDI FT4232',
  '0403:6014': 'FTDI FT232H',
  '0403:6015': 'FTDI FT230X',
  '067b:2303': 'Prolific PL2303',
  '067b:23a3': 'Prolific PL2303HXD',
  '1a86:7523': 'CH340',
  '1a86:7522': 'CH341',
  '1a86:55d4': 'CH9102',
  '2341:0043': 'Arduino Uno',
  '2341:0001': 'Arduino Mega',
}

function portLabel(port: any, idx: number): string {
  const info = port.getInfo?.() ?? {}
  const comName = info.portName ? String(info.portName) : null
  let chipName: string | null = null
  if (info.usbVendorId != null) {
    const vid = info.usbVendorId.toString(16).padStart(4, '0')
    const pid = info.usbProductId?.toString(16).padStart(4, '0')
    chipName = (pid ? USB_SERIAL_NAMES[`${vid}:${pid}`] : undefined) ?? null
    if (!chipName) chipName = pid ? `USB ${vid.toUpperCase()}:${pid.toUpperCase()}` : `USB ${vid.toUpperCase()}`
  }
  if (comName && chipName) return `${comName} (${chipName})`
  if (comName) return comName
  if (chipName) return chipName
  return `Port ${idx + 1}`
}

function loadPresets() {
  presets.value = (presetsData as any).presets ?? []
}

function onPresetExecuted(_results: CommandResult[]) {}

async function toggleSpeechProc() {
  if (speechProcBusy.value || state.value.speechProc === null) return
  speechProcBusy.value = true
  try {
    const cmd = state.value.speechProc ? 'PR10' : 'PR11'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    speechProcBusy.value = false
  }
}

async function toggleVox() {
  if (voxBusy.value || state.value.vox === null) return
  voxBusy.value = true
  try {
    // VX P1 ; — P1: 0=OFF, 1=ON
    const cmd = state.value.vox ? 'VX0' : 'VX1'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    voxBusy.value = false
  }
}

async function togglePreAmpHf() {
  if (preAmpBusy.value || state.value.preAmpHf === null) return
  preAmpBusy.value = true
  try {
    // PA 0 P2 ; — P2: 0=IPO, 1=AMP1, 2=AMP2 (cycles 0→1→2→0)
    const next = ((state.value.preAmpHf) + 1) % 3
    await send(`PA0${next}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    preAmpBusy.value = false
  }
}

async function toggleRfSql() {
  if (preAmpBusy.value || state.value.preAmpHf === null) return
  preAmpBusy.value = true
  try {
    const next = ((state.value.sqlRfMode) + 1) % 3
    await send(`EX030102${next}`)
  } catch (e: any) { lastError.value = e.message } finally { preAmpBusy.value = false }
  try {
    await send(`EX030102`)
  } catch (e: any) { lastError.value = e.message } finally {  }
}

async function togglePreAmpVhf() {
  if (preAmpBusy.value || state.value.preAmpVhf === null) return
  preAmpBusy.value = true
  try {
    // PA P1 P2 ; — P1=1 (VHF), P2: 0=OFF, 1=ON
    const cmd = state.value.preAmpVhf ? 'PA10' : 'PA11'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    preAmpBusy.value = false
  }
}

async function togglePreAmpUhf() {
  if (preAmpBusy.value || state.value.preAmpUhf === null) return
  preAmpBusy.value = true
  try {
    // PA P1 P2 ; — P1=2 (UHF), P2: 0=OFF, 1=ON
    const cmd = state.value.preAmpUhf ? 'PA20' : 'PA21'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    preAmpBusy.value = false
  }
}

async function toggleAntSelect1() {
  if (antSelectBusy.value || state.value.antSelect === null) return
  antSelectBusy.value = true
  try {
    const cmd = 'EX0307040'
    await send(cmd)
    await send('EX030704')
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    antSelectBusy.value = false
  }
}

async function toggleAntSelect2() {
  if (antSelectBusy.value || state.value.antSelect === null) return
  antSelectBusy.value = true
  try {
    const cmd = 'EX0307041'
    await send(cmd)
    await send('EX030704')
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    antSelectBusy.value = false
  }
}

async function toggleAtt() {
  if (attBusy.value) return
  attBusy.value = true
  try {
    // RA 0 P2 ; — P2: 0=OFF, 1=ON
    const cmd = state.value.rfAttenuator ? 'RA00' : 'RA01'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    attBusy.value = false
  }
}

async function toggleLock() {
  if (lockBusy.value || state.value.lock === null) return
  lockBusy.value = true
  try {
    // LK P1 ; — P1: 0=OFF, 1=ON
    const cmd = state.value.lock ? 'LK0' : 'LK1'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    lockBusy.value = false
  }
}

// GT P1 P2 ; — P1=VFO(0/1), P2=0(OFF) 1(FAST) 2(MID) 3(SLOW) 4(AUTO-F) 5(AUTO-M) 6(AUTO-S)
const AGC_CYCLE = ['0', '1', '2', '3', '4', '5', '6'] as const
const AGC_LABEL_TO_CODE: Record<string, string> = {
  'OFF': '0', 'FAST': '1', 'MID': '2', 'SLOW': '3', 'AUTO-F': '4', 'AUTO-M': '5', 'AUTO-S': '6',
}

async function cycleAgc(vfo: '0' | '1') {
  if (agcBusy.value) return
  const current = vfo === '0' ? state.value.agcMain : state.value.agcSub
  if (current === null) return
  const code    = AGC_LABEL_TO_CODE[current] ?? '0'
  const nextCode = AGC_CYCLE[(AGC_CYCLE.indexOf(code as typeof AGC_CYCLE[number]) + 1) % AGC_CYCLE.length]
  const nextCodeToSend = (parseInt(nextCode, 10)  > 4) ? '0' : nextCode
  agcBusy.value = true
  try {
    await send(`GT${vfo}${nextCodeToSend}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    agcBusy.value = false
  }
}

async function toggleNarrow(vfo: '0' | '1') {
  if (narrowBusy.value) return
  const current = vfo === '0' ? state.value.narrowMain : state.value.narrowSub
  if (current === null) return
  narrowBusy.value = true
  try {
    // NA P1 P2 ; — P1=VFO(0/1), P2=0(OFF)/1(ON)
    await send(`NA${vfo}${current ? '0' : '1'}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    narrowBusy.value = false
  }
}

const SQL_TYPE_MAX = 5

async function cycleSqlType(vfo: '0' | '1', current: number | null) {
  if (sqlTypeBusy.value || current === null) return
  sqlTypeBusy.value = true
  try {
    const next = current >= SQL_TYPE_MAX ? 0 : current + 1
    // CT P1 P2 ; — P1=VFO (0/1), P2=type (0-5)
    await send(`CT${vfo}${next}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    sqlTypeBusy.value = false
  }
}

async function setSquelch(vfo: '0' | '1', value: number) {
  const val = Math.max(0, Math.min(255, value))
  // SQ P1 xxx ; — P1=0 main / 1 sub, xxx=000-255 (3 digits, zero-padded)
  await send(`SQ${vfo}${String(val).padStart(3, '0')}`).catch((e: any) => { lastError.value = e.message })
  if (vfo==='1') {
    await send('SQ1').catch((e: any) => { lastError.value = e.message })
    await send('SQ0').catch((e: any) => { lastError.value = e.message })
  }
}

async function setRfGain(vfo: '0' | '1', value: number) {
  const val = Math.max(0, Math.min(255, value))
  // RG P1 xxx ; — P1=0 main / 1 sub, xxx=000-255 (3 digits, zero-padded)
  await send(`RG${vfo}${String(val).padStart(3, '0')}`).catch((e: any) => { lastError.value = e.message })
}

async function setAfGain(vfo: '0' | '1', value: number) {
  const val = Math.max(0, Math.min(255, value))
  // AG P1 xxx ; — P1=0 main / 1 sub, xxx=000-255 (3 digits, zero-padded)
  await send(`AG${vfo}${String(val).padStart(3, '0')}`).catch((e: any) => { lastError.value = e.message })
}

async function toggleMox() {
  if (moxBusy.value) return
  moxBusy.value = true
  try {
    // MX P1 ; — P1: 0=OFF, 1=ON
    const cmd = state.value.mox ? 'MX0' : 'MX1'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    moxBusy.value = false
  }
}

async function switchToVfo(vfo: '0' | '1') {
  if (txVfoBusy.value) return
  txVfoBusy.value = true
  try {
    await send(`FT${vfo}`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    txVfoBusy.value = false
  }
}

async function toggleRxMode() {
  if (rxModeBusy.value) return
  rxModeBusy.value = true
  try {
    // FR P1 P2 ; — P1P2: 00=Dual receive, 01=Single receive
    const cmd = state.value.rxMode === 'dual' ? 'FR01' : 'FR00'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    rxModeBusy.value = false
  }
}

async function toggleSplit() {
  if (splitBusy.value) return
  splitBusy.value = true
  try {
    // ST P1 ; — P1: 0=OFF, 1=ON
    const cmd = state.value.split ? 'ST0' : 'ST1'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    splitBusy.value = false
  }
}

async function toggleSwap() {
  if (splitBusy.value) return
  splitBusy.value = true
  try {
    // ST P1 ; — P1: 0=OFF, 1=ON
    const cmd = 'SV'
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    splitBusy.value = false
  }
}

async function setFuncKnob(cmd: string) {
  if (funcKnobBusy.value) return
  funcKnobBusy.value = true
  try {
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    funcKnobBusy.value = false
  }
}

async function sendManualCommand() {
  const cmd = manualCmd.value.trim()
  if (!cmd) return
  try {
    await send(cmd)
    manualResponse.value = 'Sent'
  } catch (e: any) {
    lastError.value = e.message
  }
}

// ── CTCSS tone picker modal ──────────────────────────────

const ctcssPopupVfo  = ref<'0' | '1' | null>(null)
const ctcssDialogRef = ref<HTMLElement | null>(null)

function openCtcssPopup(vfo: '0' | '1') {
  ctcssPopupVfo.value = vfo
  nextTick(() => {
    const dialog = ctcssDialogRef.value
    if (!dialog) return
    const active = dialog.querySelector<HTMLElement>('.ctcss-tone-btn--active')
    const first  = dialog.querySelector<HTMLElement>('.ctcss-tone-btn')
    ;(active ?? first)?.focus()
  })
}

function closeCtcssPopup() {
  ctcssPopupVfo.value = null
}

async function selectCtcssTone(vfo: '0' | '1', idx: number) {
  closeCtcssPopup()
  try {
    // CN P1 P2 P3P3P3 — P1=VFO(0/1), P2=0(CTCSS), P3P3P3=3-digit zero-padded index
    const cmd = `CN${vfo}0${String(idx).padStart(3, '0')}`
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  }
}

// ── DCS code picker modal ────────────────────────────────

const dcsPopupVfo  = ref<'0' | '1' | null>(null)
const dcsDialogRef = ref<HTMLElement | null>(null)

function openDcsPopup(vfo: '0' | '1') {
  dcsPopupVfo.value = vfo
  nextTick(() => {
    const dialog = dcsDialogRef.value
    if (!dialog) return
    const active = dialog.querySelector<HTMLElement>('.ctcss-tone-btn--active')
    const first  = dialog.querySelector<HTMLElement>('.ctcss-tone-btn')
    ;(active ?? first)?.focus()
  })
}

function closeDcsPopup() {
  dcsPopupVfo.value = null
}

async function selectDcsCode(vfo: '0' | '1', idx: number) {
  closeDcsPopup()
  try {
    // CN P1 P2 P3P3P3 — P1=VFO(0/1), P2=1(DCS), P3P3P3=3-digit zero-padded index
    const cmd = `CN${vfo}1${String(idx).padStart(3, '0')}`
    await send(cmd)
  } catch (e: any) {
    lastError.value = e.message
  }
}

// ── Saved channels ──────────────────────────────────────

function saveChannelFromVfo(vfo: '0' | '1') {
  const freq     = vfo === '0' ? state.value.mainFreq    : state.value.subFreq
  const mode     = vfo === '0' ? state.value.mainMode    : state.value.subMode
  const sqlType  = vfo === '0' ? state.value.mainSqlType : state.value.subSqlType
  const ctcssIdx = vfo === '0' ? state.value.mainCtcssTone : state.value.subCtcssTone
  const dcsIdx   = vfo === '0' ? state.value.mainDcsCode   : state.value.subDcsCode
  if (freq == null) return
  savedChannels.value = [
    ...savedChannels.value,
    { id: Date.now().toString(), freq, mode: mode ?? null, sqlType: sqlType ?? null, ctcssIdx: ctcssIdx ?? null, dcsIdx: dcsIdx ?? null },
  ]
  persistChannels()
}

async function applyChannel(ch: ChannelConfig) {
  const vfo: '0' | '1' = state.value.txVfo === 1 ? '1' : '0'
  const cmds: string[] = []
  cmds.push((vfo === '0' ? 'FA' : 'FB') + String(ch.freq).padStart(9, '0'))
  if (ch.mode) {
    const entry = MODES.find(m => m.label === ch.mode)
    if (entry) {
      cmds.push(`MD${vfo}${entry.code}`)
    }
  }
  if (ch.sqlType !== null) cmds.push(`CT${vfo}${ch.sqlType}`)
  if (ch.ctcssIdx !== null) cmds.push(`CN${vfo}0${String(ch.ctcssIdx).padStart(3, '0')}`)
  if (ch.dcsIdx !== null)   cmds.push(`CN${vfo}1${String(ch.dcsIdx).padStart(3, '0')}`)
  for (const cmd of cmds) {
    await send(cmd)
      .catch((e: any) => { lastError.value = e.message })
  }
}

function deleteChannel(id: string) {
  savedChannels.value = savedChannels.value.filter(c => c.id !== id)
  persistChannels()
}

const sortedChannels = computed(() =>
  [...savedChannels.value].sort((a, b) => a.freq - b.freq)
)

// ── Radio memory channels ──────────────────────────────
const sortedRadioChannels = computed(() =>
  Object.values(state.value.radioChannels).sort((a, b) => a.slot - b.slot)
)

const chListDirtyCount = computed(() => channelListRows.value.filter(r => r.dirty).length)

const rsgbSelected             = ref<Set<number>>(new Set())
const rsgbAllEligibleSelected  = computed(() => {
  const eligible = rsgbResults.value.filter(e => e.modeCodes.includes('A') || e.modeCodes.includes('F'))
  return eligible.length > 0 && eligible.every(e => rsgbSelected.value.has(e.id))
})
const rsgbSelectedChannelCount = computed(() =>
  rsgbResults.value
    .filter(e => rsgbSelected.value.has(e.id))
    .reduce((n, e) => n + (e.modeCodes.includes('A') ? 1 : 0) + (e.modeCodes.includes('F') ? 1 : 0), 0)
)

function saveChannelList() {
  try { localStorage.setItem('cat_channel_list', JSON.stringify(channelListRows.value)) } catch { /* quota */ }
}

function loadChannelList() {
  try {
    const raw = localStorage.getItem('cat_channel_list')
    if (raw) channelListRows.value = JSON.parse(raw)
  } catch { /* corrupt, ignore */ }
}

function syncChannelListFromState() {
  const existingRows = new Map(channelListRows.value.map(r => [r.slot, r]))
  for (const ch of sortedRadioChannels.value) {
    const existing = existingRows.get(ch.slot)
    if (existing?.dirty) {
      // Slot has pending local changes — preserve entirely, don't overwrite with radio data
      continue
    }
    // Slot is clean (already in sync) or new — take radio data, preserve local-only fields
    const tag      = ch.tag ?? existing?.tag ?? ''
    const ctcssIdx = existing?.ctcssIdx ?? null
    const dcsIdx   = existing?.dcsIdx   ?? null
    const dirty    = (tag !== '' && ch.tag == null) || ctcssIdx !== null || dcsIdx !== null
    existingRows.set(ch.slot, {
      slot:       ch.slot,
      freq:       ch.freq,
      txFreq:     ch.txFreq ?? null,
      splitMem:   ch.splitMem,
      mode:       ch.mode ?? 'USB',
      sqlType:    ch.sqlType ?? 0,
      ctcssIdx,
      dcsIdx,
      clarDir:    ch.clarDir ?? '+',
      clarOffset: ch.clarOffset ?? 0,
      rxClar:     ch.rxClar,
      txClar:     ch.txClar,
      shift:      ch.shift,
      tag,
      dirty,
    })
  }
  channelListRows.value = Array.from(existingRows.values()).sort((a, b) => a.slot - b.slot)
  saveChannelList()
}

function updateRowFreq(row: EditableChannel, mhzStr: string) {
  const hz = Math.round(parseFloat(mhzStr) * 1_000_000)
  if (!isNaN(hz) && hz > 0) { row.freq = hz; row.dirty = true }
}

function updateRowTxFreq(row: EditableChannel, mhzStr: string) {
  if (!mhzStr.trim()) { row.txFreq = null; row.dirty = true; return }
  const hz = Math.round(parseFloat(mhzStr) * 1_000_000)
  if (!isNaN(hz) && hz > 0) { row.txFreq = hz; row.splitMem = true; row.dirty = true }
}

function updateRowSlot(row: EditableChannel, newSlotStr: string) {
  const n = parseInt(newSlotStr)
  if (isNaN(n) || n < 1 || n > 999) return
  if (channelListRows.value.some(r => r !== row && r.slot === n)) return
  row.slot = n
  row.dirty = true
  channelListRows.value = [...channelListRows.value].sort((a, b) => a.slot - b.slot)
}

function addNewChannel() {
  const maxSlot = channelListRows.value.reduce((m, r) => Math.max(m, r.slot), 0)
  channelListRows.value = [...channelListRows.value, {
    slot:       Math.min(maxSlot + 1, 999),
    freq:       145_500_000,
    txFreq:     null,
    splitMem:   false,
    mode:       'FM',
    sqlType:    0,
    ctcssIdx:   null,
    dcsIdx:     null,
    clarDir:    '+',
    clarOffset: 0,
    rxClar:     false,
    txClar:     false,
    shift:      0,
    tag:        '',
    dirty:      true,
  }]
}

function deleteChannelRow(idx: number) {
  channelListRows.value = channelListRows.value.filter((_, i) => i !== idx)
}

function onDragStart(e: DragEvent, idx: number) {
  dragSrcIdx.value = idx
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, idx: number) {
  e.preventDefault()
  dragOverIdx.value = idx
}

function onDragEnd() {
  dragSrcIdx.value = null
  dragOverIdx.value = null
}

function onDrop(e: DragEvent, idx: number) {
  e.preventDefault()
  const src = dragSrcIdx.value
  if (src === null || src === idx) { onDragEnd(); return }
  const rows = [...channelListRows.value]
  const [moved] = rows.splice(src, 1)
  rows.splice(idx, 0, moved)
  const sortedSlots = channelListRows.value.map(r => r.slot).sort((a, b) => a - b)
  rows.forEach((r, i) => { r.slot = sortedSlots[i]; r.dirty = true })
  channelListRows.value = rows
  onDragEnd()
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result
}

function exportCsv() {
  const SQL_LABELS   = ['None', 'CTCSS ENC/DEC', 'CTCSS ENC', 'DCS', 'PR FREQ', 'REV TONE']
  const SHIFT_LABELS = ['Simplex', '+', '-']
  const header = 'Slot,RxFreq_MHz,TxFreq_MHz,Split,Mode,SQL_Type,CTCSS_Hz,DCS_Code,Shift,ClarDir,ClarOffset_Hz,RxClar,TxClar,Tag'
  const rows = channelListRows.value.map(r => [
    r.slot,
    (r.freq / 1_000_000).toFixed(6),
    r.txFreq !== null ? (r.txFreq / 1_000_000).toFixed(6) : '',
    r.splitMem ? '1' : '0',
    r.mode,
    SQL_LABELS[r.sqlType] ?? r.sqlType,
    r.ctcssIdx !== null ? CTCSS_TONES[r.ctcssIdx] ?? '' : '',
    r.dcsIdx   !== null ? DCS_CODES[r.dcsIdx]     ?? '' : '',
    SHIFT_LABELS[r.shift] ?? r.shift,
    r.clarDir,
    r.clarOffset,
    r.rxClar ? '1' : '0',
    r.txClar ? '1' : '0',
    `"${r.tag}"`,
  ].join(','))
  const csv = [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'ftx1-channels.csv'; a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() { csvImportRef.value?.click() }

async function onImportCsv(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const SQL_LABELS   = ['None', 'CTCSS ENC/DEC', 'CTCSS ENC', 'DCS', 'PR FREQ', 'REV TONE']
  const SHIFT_LABELS = ['Simplex', '+', '-']
  const rows: EditableChannel[] = []
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue
    const p = parseCsvLine(line)
    const slot  = parseInt(p[0])
    const freq  = Math.round(parseFloat(p[1]) * 1_000_000)
    if (isNaN(slot) || slot < 1 || slot > 999 || isNaN(freq) || freq <= 0) continue
    const txFreqRaw = parseFloat(p[2])
    const txFreq    = !isNaN(txFreqRaw) && txFreqRaw > 0 ? Math.round(txFreqRaw * 1_000_000) : null
    const splitMem  = p[3] === '1'
    const sqlType   = SQL_LABELS.indexOf(p[5])
    const ctcssHz   = parseFloat(p[6])
    const ctcssIdx  = !isNaN(ctcssHz) ? CTCSS_TONES.indexOf(ctcssHz) : -1
    const dcsCode   = parseInt(p[7])
    const dcsIdx    = !isNaN(dcsCode) ? DCS_CODES.indexOf(dcsCode) : -1
    const shift     = Math.max(0, SHIFT_LABELS.indexOf(p[8]))
    const clarDir   = p[9] === '-' ? '-' : '+'
    const clarOffset = parseInt(p[10]) || 0
    rows.push({
      slot, freq, txFreq, splitMem,
      mode:       p[4] || 'USB',
      sqlType:    sqlType >= 0 ? sqlType : 0,
      ctcssIdx:   ctcssIdx >= 0 ? ctcssIdx : null,
      dcsIdx:     dcsIdx   >= 0 ? dcsIdx   : null,
      clarDir, clarOffset,
      rxClar: p[11] === '1',
      txClar: p[12] === '1',
      shift,
      tag:   p[13]?.substring(0, 12) ?? '',
      dirty: true,
    })
  }
  if (rows.length) channelListRows.value = rows.sort((a, b) => a.slot - b.slot)
  if (csvImportRef.value) csvImportRef.value.value = ''
}

async function readAllFromRadio() {
  if (chListScanning.value) return
  chListScanning.value = true
  const from = chListScanFrom.value
  const to   = chListScanTo.value
  chListScanDone.value  = 0
  chListScanTotal.value = to - from + 1
  try {
    for (let i = from; i <= to; i++) {
      await readMemoryChannel(i)
      chListScanDone.value = i - from + 1
    }
    syncChannelListFromState()
  } finally {
    chListScanning.value = false
  }
}

async function writeAllToRadio() {
  if (chListWriting.value) return
  chListWriting.value = true
  const dirty = channelListRows.value.filter(r => r.dirty)
  chListWriteDone.value  = 0
  chListWriteTotal.value = dirty.length
  try {
    for (const row of dirty) {
      await writeMemoryChannel(row.slot, {
        freq: row.freq, txFreq: row.txFreq, splitMem: row.splitMem,
        mode: row.mode, sqlType: row.sqlType,
        clarDir: row.clarDir, clarOffset: row.clarOffset,
        rxClar: row.rxClar, txClar: row.txClar,
        shift: row.shift, tag: row.tag || null,
      }).catch((e: any) => { lastError.value = e.message })
      // Apply CTCSS/DCS: recall slot → set tone → store back
      if (row.sqlType > 0 && (row.ctcssIdx !== null || row.dcsIdx !== null)) {
        const slotStr = String(row.slot).padStart(5, '0')
        await send('MC0' + slotStr).catch(() => {})
        await send('MA').catch(() => {})
        await send(`CT0${row.sqlType}`).catch(() => {})
        if (row.ctcssIdx !== null) await send(`CN00${String(row.ctcssIdx).padStart(3, '0')}`).catch(() => {})
        if (row.dcsIdx   !== null) await send(`CN01${String(row.dcsIdx).padStart(3, '0')}`).catch(() => {})
        await send('AM').catch(() => {})
      }
      row.dirty = false
      chListWriteDone.value++
    }
    saveChannelList()
  } finally {
    chListWriting.value = false
  }
}

watch(rsgbSearchType, () => {
  rsgbSearchQuery.value = ''
  rsgbResults.value     = []
  rsgbSelected.value    = new Set()
  rsgbError.value       = null
})

function rsgbToggleAll(checked: boolean) {
  const sel = new Set<number>()
  if (checked) {
    for (const e of rsgbResults.value) {
      if (e.modeCodes.includes('A') || e.modeCodes.includes('F')) sel.add(e.id)
    }
  }
  rsgbSelected.value = sel
}

function rsgbToggleEntry(id: number, checked: boolean) {
  const sel = new Set(rsgbSelected.value)
  if (checked) sel.add(id)
  else sel.delete(id)
  rsgbSelected.value = sel
}

async function fetchRsgb() {
  const q = rsgbSearchQuery.value.trim()
  if (!q) return
  rsgbLoading.value  = true
  rsgbError.value    = null
  rsgbResults.value  = []
  rsgbSelected.value = new Set()
  try {
    const base = 'https://api-beta.rsgb.online'
    const path = rsgbSearchType.value === 'band'
      ? `/band/${encodeURIComponent(q.toLowerCase())}`
      : rsgbSearchType.value === 'callsign'
      ? `/callsign/${encodeURIComponent(q.toLowerCase())}`
      : `/locator/${encodeURIComponent(q.toLowerCase())}`
    const res = await fetch(base + path)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const json = await res.json()
    const entries: RsgbEntry[] = (Array.isArray(json?.data) ? json.data : [])
      .map((e: any) => ({ ...e, modeCodes: Array.isArray(e.modeCodes) ? e.modeCodes : [] }))
    rsgbResults.value = entries
    const sel = new Set<number>()
    for (const e of entries) {
      if (e.modeCodes.includes('A') || e.modeCodes.includes('F')) sel.add(e.id)
    }
    rsgbSelected.value = sel
  } catch (e: any) {
    rsgbError.value = String(e.message ?? 'Fetch failed')
  } finally {
    rsgbLoading.value = false
  }
}

function importRsgbChannels() {
  const selectedEntries = rsgbResults.value.filter(e => rsgbSelected.value.has(e.id))
  const existingSlots = new Set(channelListRows.value.map(r => r.slot))
  let nextSlot = rsgbAddFromSlot.value
  const newRows: EditableChannel[] = []

  for (const entry of selectedEntries) {
    const entryModes: boolean[] = []
    if (entry.modeCodes.includes('A')) entryModes.push(true)
    if (entry.modeCodes.includes('F')) entryModes.push(false)
    for (const isAnalog of entryModes) {
      if (!rsgbOverwrite.value) {
        while (existingSlots.has(nextSlot) && nextSlot <= 999) nextSlot++
      }
      if (nextSlot > 999) break

      const modeLabel  = isAnalog ? (entry.txbw <= 12.5 ? 'FM-N' : 'FM') : 'C4FM-DN'
      const ctcssMatch = isAnalog && entry.ctcss > 0 ? CTCSS_TONES.indexOf(entry.ctcss) : -1
      const ctcssIdx   = ctcssMatch >= 0 ? ctcssMatch : null
      const sqlType    = isAnalog && ctcssIdx !== null ? 2 : 0
      const town       = entry.town.substring(0, 6).padEnd(6, ' ')
      const call       = entry.repeater.substring(0, 5)
      const tag        = (town + ' ' + call).substring(0, 12)

      newRows.push({
        slot:       nextSlot,
        freq:       entry.tx,
        txFreq:     entry.rx !== entry.tx ? entry.rx : null,
        splitMem:   entry.rx !== entry.tx,
        mode:       modeLabel,
        sqlType:    isAnalog ? sqlType : 0,
        ctcssIdx:   isAnalog ? ctcssIdx : null,
        dcsIdx:     null,
        clarDir:    '+',
        clarOffset: 0,
        rxClar:     false,
        txClar:     false,
        shift:      0,
        tag,
        dirty:      true,
      })
      existingSlots.add(nextSlot)
      nextSlot++
    }
  }

  if (rsgbOverwrite.value) {
    const rowMap = new Map(channelListRows.value.map(r => [r.slot, r]))
    for (const nr of newRows) rowMap.set(nr.slot, nr)
    channelListRows.value = Array.from(rowMap.values()).sort((a, b) => a.slot - b.slot)
  } else {
    channelListRows.value = [...channelListRows.value, ...newRows].sort((a, b) => a.slot - b.slot)
  }
  rsgbDialog.value = false
}

async function scanRadioMemory() {
  if (radioMemScanning.value) return
  radioMemScanning.value = true
  try {
    await scanMemoryChannels(radioMemScanFrom.value, radioMemScanTo.value)
  } finally {
    radioMemScanning.value = false
  }
}

async function recallRadioChannel(ch: { slot: number }) {
  const slotStr = String(ch.slot).padStart(5, '0')
  await send('MC0' + slotStr).catch((e: any) => { lastError.value = e.message })
  await send('MA').catch((e: any) => { lastError.value = e.message })
}

async function openRepeaterInfo(row: EditableChannel) {
  const cs = row.tag.trim().split(/\s+/).pop()?.trim() ?? ''
  repInfoCallsign.value = cs
  repInfoResults.value  = []
  repInfoError.value    = null
  repInfoDialog.value   = true
  if (!cs) { repInfoError.value = 'No callsign found in tag.'; return }
  repInfoLoading.value  = true
  try {
    const res = await fetch(`https://api-beta.rsgb.online/callsign/${encodeURIComponent(cs.toLowerCase())}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const json = await res.json()
    const entries: RsgbEntry[] = (Array.isArray(json?.data) ? json.data : [])
      .map((e: any) => ({ ...e, modeCodes: Array.isArray(e.modeCodes) ? e.modeCodes : [] }))
    if (entries.length === 0) repInfoError.value = 'No RSGB data found for this callsign.'
    repInfoResults.value = entries
  } catch (e: any) {
    repInfoError.value = String(e.message ?? 'Fetch failed')
  } finally {
    repInfoLoading.value = false
  }
}

function repStatusClass(status: string): string {
  if (status === 'OPERATIONAL') return 'repinfo-status--ok'
  if (status?.includes('REDUCED')) return 'repinfo-status--warn'
  return 'repinfo-status--off'
}

async function writeChannelToRadio(ch: ChannelConfig) {
  const slot = radioMemWriteSlots.value[ch.id]
  if (!slot || slot < 1 || slot > 999) return
  await writeMemoryChannel(slot, { freq: ch.freq, mode: ch.mode, sqlType: ch.sqlType })
    .catch((e: any) => { lastError.value = e.message })
}

function radioChLabel(ch: RadioChannel): string {
  const mhz = (ch.freq / 1_000_000).toFixed(3)
  return `${String(ch.slot).padStart(3, ' ')} ${mhz}${ch.mode ? ' ' + ch.mode : ''}`
}

function chLabel(ch: ChannelConfig): string {
  const mhz = (ch.freq / 1_000_000).toFixed(3)
  return `${mhz}${ch.mode ? ' ' + ch.mode : ''}`
}

function chSqlLabel(ch: ChannelConfig): string | null {
  if (!ch.sqlType) return null
  if (ch.sqlType === 1 || ch.sqlType === 2) {
    const hz = ch.ctcssIdx !== null ? CTCSS_TONES[ch.ctcssIdx]?.toFixed(1) : null
    return hz ? `${sqlTypeLabel(ch.sqlType)} ${hz}Hz` : sqlTypeLabel(ch.sqlType)
  }
  if (ch.sqlType === 3) {
    const code = ch.dcsIdx !== null ? DCS_CODES[ch.dcsIdx] : null
    return code != null ? `DCS D${String(code).padStart(3, '0')}` : 'DCS'
  }
  return sqlTypeLabel(ch.sqlType)
}

// ----------- lifecycle -----------

watch(channelListRows, saveChannelList, { deep: true })

onMounted(async () => {
  const savedBaud = localStorage.getItem('cat_baud')
  if (savedBaud) selectedBaud.value = Number(savedBaud)
  loadChannels()
  loadChannelList()
  loadPresets()
  knownPorts.value = await getKnownPorts()
  const savedVidPid = localStorage.getItem('cat_port_vid_pid')
  if (savedVidPid && knownPorts.value.length) {
    const idx = knownPorts.value.findIndex(p => {
      const info = p.getInfo?.() ?? {}
      return `${info.usbVendorId}:${info.usbProductId}` === savedVidPid
    })
    if (idx >= 0) selectedPortIdx.value = idx
    else if (knownPorts.value.length === 1) selectedPortIdx.value = 0
  } else if (knownPorts.value.length === 1) {
    selectedPortIdx.value = 0
  }
})

onUnmounted(async () => {
  if (state.value.connected) await disconnect()
})
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --surface2: #21262d;
  --border: #505152;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #58a6ff;
  --green: #3fb950;
  --red: #f85149;
  --yellow: #d29922;
  --radius: 8px;
  --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.header-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.brand-logo {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--accent);
  font-family: var(--font-mono);
}

.brand-sub {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.brand-version {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  opacity: 0.6;
}

.conn-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
}

.sel {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 5px 10px;
  font-size: 13px;
  flex: 1;
  min-width: 160px;
  cursor: pointer;
}

.sel:disabled { opacity: 0.5; cursor: default; }
.baud-sel { flex: 0 0 90px; min-width: 90px; }
.port-sel { flex: 0 0 130px; min-width: 130px; }
.chlist-action-btn { min-width: 150px; }

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s;
  white-space: nowrap;
}

.btn:disabled { opacity: 0.5; cursor: default; }
.btn-primary { background: var(--accent); color: #0d1117; }
.btn-danger { background: var(--red); color: #fff; }
.btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

.conn-status {
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-ok { background: rgba(63,185,80,.15); color: var(--green); }
.status-off { background: rgba(139,148,158,.1); color: var(--text-muted); }

/* ── Error banner ── */
.compat-warning {
  background: #3d2e00;
  border-bottom: 1px solid #d29922;
  color: #d29922;
  padding: 8px 20px;
  font-size: 13px;
}

.error-banner {
  background: rgba(248,81,73,.12);
  border-bottom: 1px solid var(--red);
  color: var(--red);
  padding: 8px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--red);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

/* ── Dashboard ── */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  flex: 1;
}

/* ── TX indicator ── */
.tx-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  border-radius: var(--radius);
  background: var(--surface2);
  border: 1px solid var(--border);
  width: fit-content;
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--green);
  transition: all .2s;
}

.tx-indicator.tx-active {
  background: rgba(248,81,73,.15);
  border-color: var(--red);
  color: var(--red);
  box-shadow: 0 0 16px rgba(248,81,73,.3);
}

.tx-indicator.power-off {
  background: rgba(248,81,73,.15);
  color: var(--red);
}

.swr-alarm {
  font-size: 13px;
  font-weight: 700;
  background: var(--red);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity: .4; }
}

/* ── VFO section ── */
.vfo-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 720px) {
  .vfo-section { grid-template-columns: 1fr; }
}

.vfo-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  position: relative;
}

.main-card { border-left: 3px solid #444; }
.sub-card  { border-left: 3px solid #444; }

/* Active (TX) VFO — full orange border */
.vfo-card--tx-vfo {
  border-left: 3px solid #c35910;
  box-shadow: 0 0 0 1px rgba(249, 115, 22, .15), inset 0 0 20px rgba(249, 115, 22, .04);
}

/* Single-receive inactive VFO — greyed out, non-interactive */
.vfo-card--inactive {
  opacity: .35;
  filter: grayscale(.4);
  pointer-events: none;
  user-select: none;
}

/* Single-receive inactive VFO in non-split mode — clickable to switch TX/RX */
.vfo-card--switchable {
  opacity: .35;
  filter: grayscale(.4);
  pointer-events: none;
  user-select: none;
}

.vfo-switch-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  cursor: pointer;
  pointer-events: all;
  z-index: 10;
  background: transparent;
  transition: background 0.2s;
}

.vfo-switch-overlay:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* TX VFO badge in the card header */
.tx-vfo-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--red);
  background: rgba(248, 81, 73, .15);
  border: 1px solid rgba(248, 81, 73, .4);
  border-radius: 4px;
  padding: 4px 5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.rx-vfo-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--green);
  background: rgba(81, 248, 73, .15);
  border: 1px solid rgba(81, 248, 73, .4);
  border-radius: 4px;
  padding: 4px 5px;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}

.vfo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.band-sel {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 5px;
  padding: 3px 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  cursor: pointer;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  transition: border-color .15s;
}

.band-sel:hover:not(:disabled) {
  border-color: var(--accent);
}

/* ── Band picker modal ── */
.band-modal {
  width: 280px;
}

.band-btn-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 12px;
}

.band-modal-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  padding: 9px 4px;
  background: var(--surface-2, #1e2330);
  border: 2px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  transition: background .1s, border-color .1s;
  outline: none;
}

.band-modal-btn:hover {
  background: rgba(59, 130, 246, .2);
  border-color: #3b82f6;
  color: #93c5fd;
}

.band-modal-btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}

.band-modal-btn--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  font-weight: 700;
}

.band-sel:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.band-sel:disabled {
  opacity: .45;
  cursor: default;
}

.vfo-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text-muted);
  font-weight: 600;
}

.mode-sel {
  background: #6b7280;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  cursor: pointer;
  transition: filter .15s;
  text-align: center;
  white-space: nowrap;
}

.mode-sel:hover:not(:disabled) {
  filter: brightness(1.15);
}

/* ── Mode picker modal ── */
.mode-modal {
  width: 300px;
}

.mode-btn-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 12px;
}

.btn-up {
  width: 40px;
  flex: none;
}

.mode-modal-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 9px 4px;
  border: 2px solid transparent;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  text-align: center;
  transition: filter .1s, border-color .1s;
  outline: none;
}

.mode-modal-btn:hover {
  filter: brightness(1.2);
}

.mode-modal-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, .8);
  outline-offset: 1px;
}

.mode-modal-btn--active {
  border-color: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, .35);
}

.mode-sel:focus {
  outline: 2px solid rgba(255,255,255,.5);
  outline-offset: 1px;
}

.mode-sel:disabled {
  opacity: .45;
  cursor: default;
}

.mode-sel option {
  background: #1c2128;
  color: #e6edf3;
  font-weight: 600;
}

.sql-cycle-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.sql-cycle-val {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.freq-display {
  font-family: var(--font-mono);
  font-size: 42px;
  font-weight: 300;
  letter-spacing: 2px;
  color: #e6edf3;
  line-height: 1;
  transition: color .2s;
  white-space: nowrap;
}

.freq-display.freq-tx { color: var(--red); }
.freq-sub { font-size: 42px; color: #c9d1d9; }

.freq-sep {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  margin: 2px 6px;
  flex-shrink: 0;
}

.freq-tuner {
  display: flex;
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: 42px;
  font-weight: 300;
  letter-spacing: 2px;
  color: #e6edf3;
  line-height: 1;
  white-space: nowrap;
}

.freq-tuner.freq-sub { font-size: 42px; color: #c9d1d9; }
.freq-tuner.freq-tx  { color: var(--red); }

.freq-dot {
  color: var(--text-muted);
  pointer-events: none;
  user-select: none;
  letter-spacing: 0;
  margin: 0 3px;
}

.freq-group {
  display: inline-block;
  width: 3ch;
  text-align: right;
  cursor: ns-resize;
  border-radius: 4px;
  padding: 0 2px;
  user-select: none;
  transition: background .1s, color .1s;
}

.freq-group:hover {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}

.freq-tuner.freq-tx .freq-group:hover {
  background: rgba(239, 68, 68, .2);
}

.freq-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  margin-top: 22px;
}

.freq-unit {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  padding-top: 18px;
  padding-left: 4px;
}

/* ── Status section ── */
.status-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ── Presets section ── */
/* ── Saved channels panel ── */
.channels-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  flex: 0 0 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.channels-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channels-count {
  font-size: 10px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1px 6px;
  color: var(--text-muted);
}

.channels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.channels-empty {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.channels-write-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.channels-write-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.channels-write-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.channels-write-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-family: var(--font-mono);
}

.ch-freq-sm {
  color: var(--text);
  font-weight: 600;
}

.slot-input {
  width: 48px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 4px;
  text-align: center;
}

.slot-sep {
  color: var(--text-muted);
  font-size: 11px;
}

.radio-mem-scan {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.ch-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  font-size: 10px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.ch-badge:hover {
  border-color: #f97316;
  background: rgba(249, 115, 22, .08);
}

.ch-freq {
  color: var(--text);
  font-weight: 600;
}

.ch-sql {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

.ch-del {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 2px;
  border-radius: 3px;
  flex-shrink: 0;
}

.ch-del:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, .12);
}

.presets-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
}

.presets-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.presets-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.presets-hint code {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
}

.presets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* ── Manual command ── */
.cmd-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 16px;
}

.cmd-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
}

.cmd-input {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 5px 10px;
  font-family: var(--font-mono);
  font-size: 13px;
  width: 200px;
}

.cmd-input:focus { outline: 2px solid var(--accent); }

.cmd-response {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--green);
  padding: 3px 8px;
  background: rgba(63,185,80,.08);
  border-radius: 4px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Idle screen ── */
.idle-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 40px;
}

.idle-icon { font-size: 64px; line-height: 1; }
.idle-screen p { font-size: 15px; line-height: 1.6; }
.idle-hint { font-size: 13px; }
.idle-hint code {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: var(--font-mono);
  color: var(--text);
}

/* ── SQL / CTCSS / DCS info row inside VFO card ── */
.sql-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 4px;
}

.sql-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid;
  white-space: nowrap;
}

.sql-tone {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  /*color: var(--text-muted);*/
  color: rgb(234, 211, 238);
}

/* ── TX bar (TX indicator + FUNC KNOB widget) ── */
.txbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.func-knob-widget {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 14px;
  flex-wrap: wrap;
}

.func-knob-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.func-knob-value {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  min-width: 90px;
  white-space: nowrap;
}

.func-knob-btns {
  display: flex;
  gap: 6px;
}

.btn-active {
  background: var(--surface2);
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

/* ── Bottom panels row ── */
.bottom-panels {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

/* ── Scope panel ── */
.scope-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 340px;
  flex-shrink: 0;
}

.scope-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text-muted);
}

/* level bar */
.scope-level-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-level-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8b949e;
  white-space: nowrap;
  width: 38px;
  flex-shrink: 0;
}

.scope-level-track {
  flex: 1;
  height: 9px;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  overflow: visible;
}

.scope-level-track:hover {
  border-color: #6e7681;
}

.scope-level-center {
  position: absolute;
  left: 50%;
  top: -3px;
  width: 1px;
  height: 13px;
  background: #6e7681;
  transform: translateX(-50%);
  pointer-events: none;
}

.scope-level-fill {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 3px;
  transition: left .1s ease-out, width .1s ease-out;
  pointer-events: none;
}

.scope-level-val {
  font-size: 9px;
  font-family: 'SF Mono', monospace;
  color: #8b949e;
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

/* controls row */
.scope-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scope-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.scope-group-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8b949e;
  margin-right: 4px;
  white-space: nowrap;
}

.scope-sep {
  width: 1px;
  height: 32px;
  background: var(--border);
  flex-shrink: 0;
}

.btn-xs {
  font-size: 10px;
  padding: 3px 7px;
}

.scope-btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  white-space: nowrap;
}

.scope-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

.scope-btn--active {
  background: color-mix(in srgb, var(--accent) 15%, var(--surface2));
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 700;
}

.scope-color-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 10px;
  white-space: nowrap;
}

.scope-color-btn .scope-group-lbl {
  margin-right: 0;
}

/* ── Footer ── */
.footer {
  padding: 8px 20px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.footer-fw {
  font-family: var(--font-mono);
  color: var(--text-dim, #9ca3af);
  letter-spacing: 0.04em;
}

/* ── DNR wheel wrapper ── */
.dnr-wrap { display: inline-flex; }
.dnr-wrap--active { cursor: ns-resize; }

/* ── CTCSS / DCS tone picker modals ── */
.tone-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, .65);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tone-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 16px 48px rgba(0, 0, 0, .85);
  width: 360px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tone-modal--dcs {
  width: 450px;
}

.tone-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 9px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tone-modal-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--text-dim, #9ca3af);
}

.tone-modal-close {
  background: none;
  border: none;
  color: var(--text-dim, #9ca3af);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background .1s, color .1s;
}

.tone-modal-close:hover {
  background: rgba(255, 255, 255, .1);
  color: var(--text);
}

.ctcss-tone-grid,
.dcs-code-grid {
  padding: 10px;
  overflow-y: auto;
  display: grid;
  gap: 4px;
}

.ctcss-tone-grid {
  grid-template-columns: repeat(5, 1fr);
}

.dcs-code-grid {
  grid-template-columns: repeat(6, 1fr);
}

.ctcss-tone-btn {
  font-size: 10px;
  padding: 6px 2px;
  background: var(--surface-2, #1e2330);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  text-align: center;
  transition: background .1s, border-color .1s, outline .1s;
  outline: none;
}

.ctcss-tone-btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}

.ctcss-tone-btn:hover {
  background: rgba(59, 130, 246, .25);
  border-color: #3b82f6;
  color: #93c5fd;
}

.ctcss-tone-btn--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  font-weight: 700;
}

/* ── Tab bar ── */
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 0 0 0 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 8px 16px;
  cursor: pointer;
  transition: color .15s, border-color .15s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn--active {
  color: var(--text);
  border-bottom-color: #f97316;
}

/* ── Channel List tab ── */
.channel-list-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chlist-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chlist-toolbar-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 2px;
}

.chlist-scan-range {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chlist-range-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 2px;
}

.chlist-count {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
}

.csv-hidden-input {
  display: none;
}

.chlist-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-height: calc(100vh - 240px);
  overflow-y: auto;
}

.chlist-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.chlist-table thead {
  position: sticky;
  top: 0;
  background: var(--surface2);
  z-index: 1;
}

.chlist-table th {
  padding: 7px 8px;
  text-align: left;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.chlist-table td {
  padding: 2px 4px;
  border-bottom: 1px solid rgba(80,81,82,.4);
  vertical-align: middle;
}

.chlist-table tbody tr:hover {
  background: rgba(255,255,255,.03);
}

.chlist-table tbody tr:last-child td {
  border-bottom: none;
}

.row-dirty {
  background: rgba(249, 115, 22, .05) !important;
}

.row-dirty .cell-slot {
  color: #f97316;
}

.row-drag-over {
  outline: 1px solid #f97316;
  outline-offset: -1px;
}

.td-drag {
  color: var(--text-muted);
  cursor: grab;
  padding: 0 6px;
  font-size: 14px;
  user-select: none;
}

.td-drag:active {
  cursor: grabbing;
}

.td-slot-edit {
  padding: 2px 4px;
}

.td-actions {
  padding: 2px 6px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.cell-input {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 4px;
  transition: border-color .1s, background .1s;
}

.cell-input:hover {
  border-color: var(--border);
  background: var(--surface2);
}

.cell-input:focus {
  outline: none;
  border-color: #f97316;
  background: var(--surface2);
}

.cell-slot  { width: 46px; text-align: right; }
.cell-freq  { width: 108px; }
.cell-tag   { width: 108px; }

.cell-select {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 4px;
  cursor: pointer;
  transition: border-color .1s, background .1s;
}

.cell-select:hover {
  border-color: var(--border);
  background: var(--surface2);
}

.cell-select:focus {
  outline: none;
  border-color: #f97316;
  background: var(--surface2);
}

.cell-select:disabled {
  color: var(--text-muted);
  cursor: default;
  opacity: .4;
}

.cell-ctcss { width: 90px; }
.cell-dcs   { width: 74px; }

.btn-del {
  color: var(--text-muted);
  background: none;
  border-color: transparent;
}

.btn-del:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239,68,68,.1);
}

.chlist-empty {
  padding: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

.th-drag    { width: 28px; }
.th-slot    { width: 56px; }
.th-freq    { width: 118px; }
.th-split   { width: 42px; text-align: center; }
.th-mode    { width: 96px; }
.th-sql     { width: 118px; }
.th-ctcss   { width: 90px; }
.th-dcs     { width: 68px; }
.th-shift   { width: 80px; }
.th-tag     { width: 114px; }
.th-actions { width: 136px; }

.td-split {
  text-align: center;
}

.cell-checkbox {
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: #f97316;
}

/* ── RSGB dialog ── */
.rsgb-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rsgb-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: min(860px, 95vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.rsgb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.rsgb-title {
  font-weight: 600;
  font-size: 13px;
}

.rsgb-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.rsgb-type-sel {
  width: 110px;
}

.rsgb-query-input {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-size: 12px;
  font-family: var(--font-mono);
  padding: 5px 8px;
}

.rsgb-query-input:focus {
  outline: none;
  border-color: #f97316;
}

.rsgb-mode-note {
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 4px;
  padding: 6px 10px;
  flex-shrink: 0;
}

.rsgb-error {
  font-size: 11px;
  color: #ef4444;
  background: rgba(239,68,68,.08);
  border: 1px solid rgba(239,68,68,.3);
  border-radius: 4px;
  padding: 6px 10px;
  flex-shrink: 0;
}

.rsgb-summary {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.rsgb-table-wrap {
  overflow-y: auto;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 4px;
  min-height: 0;
}

.rsgb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.rsgb-table thead {
  position: sticky;
  top: 0;
  background: var(--surface2);
  z-index: 1;
}

.rsgb-table th {
  padding: 6px 8px;
  text-align: left;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.rsgb-table td {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(80,81,82,.4);
}

.rsgb-table tbody tr:hover {
  background: rgba(255,255,255,.03);
}

.rsgb-no-match {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 20px;
  flex-shrink: 0;
}

.rsgb-import-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.rsgb-import-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.rsgb-import-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
}

.rsgb-import-check input[type="checkbox"] {
  accent-color: #f97316;
  cursor: pointer;
}

.rsgb-import-spacer {
  flex: 1;
}

/* ── Repeater info dialog ── */
.repinfo-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: min(560px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
}

.repinfo-callsign {
  font-family: var(--font-mono);
  color: var(--accent);
}

.repinfo-loading {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.repinfo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.repinfo-card {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repinfo-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.repinfo-rptr {
  font-weight: 700;
  font-size: 14px;
  font-family: var(--font-mono);
  color: var(--accent);
  flex: 1;
}

.repinfo-status {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.repinfo-status--ok   { background: rgba(34,197,94,.15);  color: #22c55e; }
.repinfo-status--warn { background: rgba(249,115,22,.15); color: #f97316; }
.repinfo-status--off  { background: rgba(239,68,68,.12);  color: #ef4444; }

.repinfo-link {
  text-decoration: none;
  white-space: nowrap;
}

.repinfo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: var(--font-mono);
}

.repinfo-table td {
  padding: 3px 6px;
}

.repinfo-table td:nth-child(odd) {
  color: var(--text-muted);
  width: 90px;
  white-space: nowrap;
}

.repinfo-table td:nth-child(even) {
  font-weight: 500;
}

.rsgb-band-sel {
  flex: 1;
}

.th-rsgb-chk,
.td-rsgb-chk {
  width: 30px;
  padding: 4px 6px;
  text-align: center;
}

.rsgb-row-ineligible {
  opacity: .4;
}

.rsgb-summary strong {
  color: var(--text);
}
</style>
