# FTX-1 CAT Interface — Working Notes

Radio ID: `0840` (returned by `ID;`)  
Baud: 38400, 8N1  
All commands terminated with `;`

---

## Mode switching (VM)

Two separate VM commands with the same prefix:

| Command | Function |
|---------|----------|
| `VM000;` | Switch main side to VFO mode |
| `VM011;` | Switch main side to Memory mode |
| `VM0;` | Query current mode → returns `VM000;` or `VM011;` |
| `VM;` | Store main VFO → current memory slot (same as `AM;`) |

**`FA`, `MD0`, `CT0`, `CN00` are rejected (`?;`) when in memory mode.**  
Must be in VFO mode before setting VFO parameters.

---

## Write memory channel (confirmed working)

Set all parameters on VFO first, then select slot and commit:

```
VM000               ensure VFO mode
FA{rxFreq}          RX frequency (9 digits, Hz)
MD0{modeCode}       mode (B=FM-N, 4=FM, H=C4FM-DN, 2=USB, etc.)
CT0{sqlType}        SQL type (0=off, 1=CTCSS ENC, 2=CTCSS ENC/DEC, 3=DCS)
CN00{idx}           CTCSS tone index 000-049 (only if sqlType 1-2)
CN01{idx}           DCS code index 000-103 (only if sqlType 3)
MC0{slot}           select target slot → switches to memory mode, preserves VFO register
VM000               switch back to VFO mode (VFO register is intact)
AM                  store VFO → slot selected by MC0 (works in VFO mode only)
MZ{slot}{split}{txFreq}   write split TX freq (AM does not cover this)
MT{slot}{tag}       write tag — up to 12 ASCII chars, space-padded
```

**Key behaviour of MC0:** selecting a slot switches the radio to memory mode and loads that
slot's data into the *display*, but the underlying VFO register is preserved. `VM000` after
`MC0` restores the VFO display and keeps the MC0 slot pointer — so `AM` then stores to the
correct slot.

---

## Read memory channel (confirmed working)

Stay in memory mode for the full scan — no per-slot mode switching:

```
VM011               switch to memory mode ONCE before scan loop

per slot:
  MC0{slot}         select slot (radio displays this channel)
  MR{slot}          read freq / mode / sqlType / shift  (works in any mode)
  MZ{slot}          read split TX freq                  (works in any mode)
  MT{slot}          read tag                            (works in any mode)
  CN00              read CTCSS tone for current display slot (memory mode required)
  CN01              read DCS code for current display slot   (if sqlType 3+)

(no VM000 at end — radio stays in memory mode)
```

---

## MR response format (27 chars)

`MR NNNNN FFFFFFFFF D OOOO R T M X S PP P`

| Chars (0-idx) | Field | Notes |
|---|---|---|
| 0–4 | slot | 5-digit slot number |
| 5–13 | freq | 9-digit Hz |
| 14 | clarDir | `+` or `-` |
| 15–18 | clarOffset | 4-digit Hz |
| 19 | rxClar | 0/1 |
| 20 | txClar | 0/1 |
| 21 | mode | see mode codes below |
| 22 | P7 | 0=VFO 1=Memory 2=MemTune 3=QMB |
| 23 | sqlType (P8) | SQL type — **different mapping from CT** (see below) |
| 24–25 | P9 | fixed `00` |
| 26 | shift (P10) | 0=Simplex 1=Plus 2=Minus |

**MR P8 ↔ CT P2 mapping (different orderings):**

| MR P8 | MR label | CT P2 | CT label |
|-------|----------|-------|----------|
| 0 | OFF | 0 | CTCSS OFF |
| 1 | CTCSS ENC/DEC | 2 | CTCSS ENC ON / DEC ON |
| 2 | CTCSS ENC | 1 | CTCSS ENC ON / DEC OFF |
| 3 | DCS | 3 | DCS ON |
| 4 | PR FREQ | 4 | PR FREQ |
| 5 | REV TONE | 5 | REV TONE |

MR does **not** contain the CTCSS tone index — only the type. Use `CN00` to get the tone.

---

## Mode codes (MD / MR)

| Code | Mode |
|------|------|
| 0 | AMS |
| 1 | LSB |
| 2 | USB |
| 3 | CW-U |
| 4 | FM |
| 5 | AM |
| 6 | RTTY-L |
| 7 | CW-L |
| 8 | DATA-L |
| 9 | RTTY-U |
| A | DATA-FM |
| B | FM-N |
| C | DATA-U |
| D | AM-N |
| E | PSK |
| F | DATA-FM-N |
| H | C4FM-DN |
| I | C4FM-VW |

---

## CTCSS tone table (CN00 / CN01)

`CN P1 P2 P3P3P3;` — P1=side(0/1), P2=type(0=CTCSS,1=DCS), P3=index  
Indices 000–049 (CTCSS), 000–103 (DCS)

First 20 CTCSS tones:
```
000=67.0  001=69.3  002=71.9  003=74.4  004=77.0
005=79.7  006=82.5  007=85.4  008=88.5  009=91.5
010=94.8  011=97.4  012=100.0 013=103.5 014=107.2
015=110.9 016=114.8 017=118.8 018=123.0 019=127.3
```

---

## MZ split format

`MZ NNNNN P P3P3P3P3P3P3P3P3P3;`

- NNNNN = `00000` for VFO mode, or slot number for memory slot
- P = `0` (split OFF) or `1` (split ON)
- P3 = TX frequency in Hz (9 digits)

---

## Bulk write — timing

Fire-and-forget `send()` for 100 channels causes serial buffer overflow on the radio.
Commands are queued to Web Serial internal buffer faster than the radio processes them,
causing wrong slots to be written.

**Fix:** add delay after `AM` per channel (100–200 ms minimum) or use a follow-up
query to block until the radio has processed the store.

---

## AM vs VM; (both store VFO → memory)

Both `AM;` and `VM;` (no params) do "MAIN-SIDE TO MEMORY CHANNEL".
Both work in VFO mode only (capability: O X X X).
`AM;` confirmed working in tests. `VM;` untested but documented identically.
