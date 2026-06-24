# FreqWave EQ — Browser Extension

## What this is

A Manifest V3 Chrome extension that captures audio from the active tab,
processes it through an 8-band EQ + Voice Enhancer engine, and plays the
processed audio back. Goal: improve the audio of videos, movies, and
podcasts where the original mix is poor (especially voice-over-music
balance).

## Status

Personal project, pre-release (v1.0 in progress). Not currently in the
Chrome Web Store. Active priority is shipping v1.0.

## Tech stack

- Manifest V3 Chrome extension
- React + TypeScript + Vite + TailwindCSS for the popup UI
- Web Audio API for audio processing (runs in an offscreen document)
- chrome.tabCapture API for capturing tab audio
- chrome.storage.sync for settings persistence

## Architecture

Three execution contexts, communicating via chrome.runtime messages:

1. **Popup (React)** — UI only. EQ sliders, knobs, presets, visualizer.
   Sends control messages. Does NOT touch audio directly.
2. **Service worker** — Coordinator. Routes messages between popup and
   offscreen document. Manages tab capture handoff. Creates offscreen
   document on demand (lazy). Does NOT process audio.
3. **Offscreen document** — The audio engine. Holds the AudioContext,
   builds the audio graph, receives parameter updates via messages.

## Active source files (post-cleanup)

Use these. Anything not on this list, do not create or restore.

```
src/
  popup/
    main.tsx                          # popup entry
    Popup.tsx                         # wraps FreqWavePopup
    popup.html
  components/eq/
    FreqWavePopup.tsx                 # main popup UI — edit THIS for popup changes
    Knob.tsx                          # Master + Pre-Amp knobs
    BandFader.tsx                     # 8 band sliders
    Spectrum.tsx                      # live FFT visualizer
  background/
    service-worker.ts                 # coordinator
  offscreen/
    offscreen.html
    offscreen.ts                      # audio engine
  messages/
    types.ts                          # message protocol — shared
  shared/
    settings.ts                       # chrome.storage.sync wrapper
  index.css                           # global styles
manifest.json
```

If a file has a kebab-case duplicate (e.g., `freqwave-popup.tsx` next to
`FreqWavePopup.tsx`), the kebab-case one is dead code from an earlier
migration and must not be edited or referenced.

## Audio graph

```
source (MediaStreamAudioSourceNode from getUserMedia)
  → pre-amp (GainNode)
  → 8 × BiquadFilterNode
  → master gain (GainNode)
  → [DynamicsCompressorNode — active only when Voice Enhancer = LEVELER]
  → analyser (AnalyserNode, for visualizer)
  → destination (AudioContext.destination)
```

### Band configuration (locked)

| Band | Frequency | Type      |
| ---- | --------- | --------- |
| 0    | 32 Hz     | lowshelf  |
| 1    | 64 Hz     | peaking   |
| 2    | 125 Hz    | peaking   |
| 3    | 250 Hz    | peaking   |
| 4    | 500 Hz    | peaking   |
| 5    | 1 kHz     | peaking   |
| 6    | 4 kHz     | peaking   |
| 7    | 8 kHz     | highshelf |

- Q factor for peaking filters: 1.41
- Gain range per band: ±12 dB
- Default state: all bands at 0 dB (flat)

### Gain controls (current — replaces earlier spec)

- **Master Volume**: symmetric ±12 dB, default 0 dB at 12 o'clock.
  Linear in dB, then gain = 10^(dB/20).
- **Pre-amp**: symmetric ±12 dB, default 0 dB at 12 o'clock.
  Same mapping as Master.

Both knobs use dB-to-gain conversion. Unity gain (no audible level
change vs. bypassed signal) MUST hold when both knobs read 0.0 dB AND
all bands at 0 dB AND Voice Enhancer = OFF. This was a critical bug
(extension was attenuating by −30.5 dB at "default") and must not
regress.

### Voice Enhancer (DSP modes)

Four modes: OFF / DIALOGUE / LEVELER / CLARITY.

- **OFF** — bypass
- **DIALOGUE** — EQ curve: `[-3, -2, 0, 2, 3, 4, 2, 0]`
- **LEVELER** — EQ curve: `[1, 1, 1, 0, 0, 1, 1, 1]` + DynamicsCompressorNode
  active (threshold -24, ratio 4, attack 0.01, release 0.15, knee 30)
- **CLARITY** — EQ curve: `[-1, 0, 1, 2, 3, 5, 6, 4]`

LEVELER is the only mode that engages the compressor. OFF/DIALOGUE/CLARITY
bypass it.

## Architectural decisions (locked)

### Power toggle UX

- The "Engine On / Off" pill in the popup IS the toggle. No separate
  power button.
- Three states: **Idle**, **Starting** (brief intermediate during capture
  initialization), **Active** (rendered as "Engine On").
- Click pill → start. Click again → stop.

### Tab capture behavior — sticky

- Engine attaches to the tab it was started on and stays there even
  when the user switches tabs.
- When popup opens on a different tab than the captured one, show the
  hostname of the captured tab (e.g., "Capturing: youtube.com").
- Reject new START_CAPTURE attempts while a capture is active.
- Service worker tracks captured tab ID + hostname.

### Captured tab closed / navigated away

- Offscreen doc listens for `onended` on the audio track.
- When the stream ends, offscreen sends ENGINE_STOPPED to service worker.
- Service worker updates state to idle.
- Popup, if open, receives state-change message and pill returns to "Off".
- Stop silently — no error dialogs, no auto-reconnect.

### Offscreen document lifecycle — lazy, persistent

- Do NOT create on install.
- Create on the **first** START_CAPTURE.
- Use a ready-handshake: offscreen sends `OFFSCREEN_READY` when its
  script has loaded and AudioContext is initialized. Service worker
  waits for this before sending the stream ID.
- On STOP_CAPTURE, disconnect the audio graph but **keep the offscreen
  document alive**. Subsequent starts just rebuild the graph in the
  existing doc.
- Service worker must handle its own suspension/wake: on wake, query
  offscreen for current state rather than assuming.

### Visualizer

- AnalyserNode-driven, live FFT of post-processing audio.
- Calm/idle when engine is off (don't animate constantly when bypassed).
- Spectrum view; waveform option deferred.

### Persistence (current)

- chrome.storage.sync wrapper in `src/shared/settings.ts`.
- All user-visible settings persist across Chrome restart:
    - 8 band values
    - Master and Pre-Amp values
    - Selected Voice Enhancer mode
- The "engine on/off" state does NOT persist — extension boots in Off
  state on Chrome restart. Settings are preserved; capture is not
  auto-resumed.
- On every user-initiated state change (slider end-drag, knob change-end,
  mode click), write to chrome.storage.sync. Popup reads from storage
  on mount and hydrates UI before first render (no flash of default
  values).

## Message protocol

Typed message constants in `src/messages/types.ts`.

**Popup → Service Worker:**

- `START_CAPTURE`
- `STOP_CAPTURE`
- `SET_BAND_GAIN` { bandIndex, gainDb }
- `SET_PREAMP_GAIN` { gainDb }
- `SET_MASTER_GAIN` { gainDb }
- `SET_VOICE_MODE` { mode: 'OFF' | 'DIALOGUE' | 'LEVELER' | 'CLARITY' }
- `SET_BYPASS` { bypassed: boolean }
- `QUERY_STATE`

**Service Worker → Offscreen Document:**

- `INIT_CAPTURE` { streamId }
- `TEARDOWN_CAPTURE`
- (forwarded versions of the SET\_\* messages)

**Offscreen → Service Worker:**

- `OFFSCREEN_READY`
- `ENGINE_STOPPED` (stream ended unexpectedly)

**Service Worker → Popup:**

- `STATE_CHANGED` { state, capturedTabId, capturedHostname }

Do NOT overload SET_GAIN to handle pre-amp, master, and bands.
Use the separate typed messages above.

## Current state (what's working — do not regress)

- Audio engine end-to-end: tabCapture → offscreen → audio graph → output
- Unity gain at default (0 dB on both knobs, all bands at 0 dB, OFF mode)
- Symmetric ±12 dB knob ranges with double-click reset
- ZERO/RESET button resets all bands AND both knobs to 0 dB
- Voice Enhancer with compressor on LEVELER mode
- Settings persistence across Chrome restart via chrome.storage.sync
- Live FFT spectrum visualizer
- Capture-tab-sticky behavior with hostname display
- Engine On/Off pill with three-state badge

## Known issues (priority order)

1. **CRITICAL: Fullscreen bug.** When the extension is active on a tab,
   the tab cannot enter fullscreen (e.g., YouTube fullscreen button does
   nothing or exits immediately). This is a v1.0 ship-blocker.

    Note: this is NOT a Chrome platform restriction. The Chrome
    tabCapture docs explicitly include a `fullscreen` property on the
    tab capture state. Simpler EQ extensions using the same MV3 +
    tabCapture + offscreen pattern do not have this bug. The cause is
    in our specific implementation, almost certainly in how the
    offscreen document consumes the MediaStream. The fix is not
    "tear down capture on fullscreen."

2. **UI polish (cosmetic, not blockers but should land before v1.0):**
    - Popup left edge crops in some viewport sizes
    - Master Volume arc shifts hue toward yellow at high |dB|
    - Spectrum visualizer waveform clips at top/bottom of container
    - Capturing-hostname line causes layout shift when ENGINE OFF hides it
    - Cursor on knobs/sliders shows resize cursor instead of pointer/grab

3. Pending UX confirmations:
    - Per-site vs. global EQ settings (deferred to v1.1)
    - Custom user-saved presets (deferred to v1.1)

## Code conventions

- Functional React components with hooks, no class components
- TailwindCSS utility classes; avoid inline styles unless dynamic
- Audio engine is plain TypeScript (not React) — runs in offscreen
  doc context, no DOM
- File naming: **PascalCase for React component files**, camelCase or
  kebab-case for utility/non-component files
- When in doubt about which file to edit, consult the "Active source
  files" section above and the import graph from popup/main.tsx or
  manifest.json

## How to work on this project

- Dev mode: `npm run dev` (Vite watch)
- Build: `npm run build`
- Load into Chrome: chrome://extensions → Developer mode → Load unpacked → `dist/`
- After code changes, click the reload icon on the extension card
- Test target: YouTube in a regular tab for general audio; podcast sites
  (e.g., a Spotify podcast page) for Voice Enhancer testing

## What NOT to do

- Don't move the audio engine into the service worker. Service workers
  cannot use Web Audio API. Non-negotiable.
- Don't skip the ready-handshake. Sending stream IDs before the
  offscreen doc is ready creates hard-to-debug timing bugs.
- Don't destroy the offscreen document on STOP_CAPTURE. Lifecycle is
  lazy-create then persistent until extension unload.
- Don't auto-reconnect when the captured tab closes. Stop silently.
- Don't edit any kebab-case duplicate file (e.g., freqwave-popup.tsx).
  Those are dead code. Edit the PascalCase version.
- Don't add error dialogs or toast notifications for the closed-tab
  case. State change should be silent and visual only.
- Don't overload SET_GAIN — use the separate typed messages defined
  in the message protocol.
- Don't add features beyond what's specified. We'll iterate after v1.0.
- Don't refactor working code unless asked. Half-finished refactors are
  worse than messy working code.
- Don't accept "Chrome platform restriction" as an answer to the
  fullscreen bug — other extensions work, the bug is in our code.
- Don't change the gain mapping or knob ranges. The current values
  (symmetric ±12 dB, 0 dB at 12 o'clock, linear in dB) are locked.
- Don't break unity gain. If both knobs read 0 dB and all bands are 0 dB
  with Voice Enhancer OFF, output level MUST equal bypassed input level.

## How to use this file when working with Claude Code

Reference this document at the start of any prompt that touches code:

> Read `CLAUDE.md` at the project root before doing anything. The "Active
> source files" section tells you which files are live. The "What NOT to do"
> section lists banned approaches. The "Known issues" section lists what's
> currently broken and what's been fixed (don't re-break it).

If something in this doc is wrong or outdated, fix it in a separate pass
before changing code.
