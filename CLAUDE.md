# FreqWave EQ — Browser Extension

## What this is

A Manifest V3 Chrome extension that captures audio from the active tab,
processes it through an 8-band EQ + Voice Enhancer engine, and plays the
processed audio back. Goal: improve the audio of videos, movies, and
podcasts where the original mix is poor (especially voice-over-music
balance).

## Status

**Published v1.0.0** on the Chrome Web Store as of June 29, 2026.

- Chrome Web Store: https://chromewebstore.google.com/detail/freqwave-eq/emikokoknlgeiloipjheoafjjeoicjap
- Repository: https://github.com/Bob3x/freqwave-eq
- Landing page: https://bob3x.github.io/freqwave-eq/
- Privacy policy: https://bob3x.github.io/freqwave-eq/privacy.html
- Category: Entertainment
- Publisher: Borislav Ginov (non-trader)
- Visibility: Public

Active phase: post-launch maintenance and v1.0.1/v1.1 planning. No new
features should be added without explicit decision — the priority is
stability and any feedback from real users.

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
  assets/                             # extension-side runtime assets (icons used by manifest)
manifest.json

docs/                                 # public-facing GitHub Pages content
  index.html                          # landing page
  privacy.html                        # privacy policy
  favicon.png
  media/                              # archival visuals, screenshots, mockups (not code-side)
```

Kebab-case duplicate files have been deleted in cleanup. If a kebab-case
variant ever reappears (e.g., `freqwave-popup.tsx`), it is regression —
do not edit it; restore the PascalCase as the active file.

Note: `src/assets/` (runtime, used by manifest/components) and
`docs/media/` (archival + public website) are separate folders for
separate purposes. Do not consolidate them.

## Audio graph

```
source (MediaStreamAudioSourceNode from getUserMedia)
  → pre-amp (GainNode)
  → 8 × BiquadFilterNode
  → master gain (GainNode)
  → [DynamicsCompressorNode — active when Compressor is enabled]
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

### Gain controls

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
- **LEVELER** — EQ curve: `[1, 1, 1, 0, 0, 1, 1, 1]`
- **Compressor** — independent toggle; when enabled, threshold -24, ratio 4,
  attack 0.01, release 0.15, knee 30
- **CLARITY** — EQ curve: `[-1, 0, 1, 2, 3, 5, 6, 4]`

The compressor can be enabled in any Voice Enhancer mode, including OFF.

## Visual design tokens

- **Accent color (neon green):** `#84e80c`. Use the `--accent` CSS custom
  property. Older `#a9e80c` was deprecated for being too yellow-green.
- The accent is the only color used for active state, position indicators,
  and emphasis. Inactive elements are muted gray.
- The same accent and color tokens are used in the public landing page
  (`docs/index.html`) and privacy policy (`docs/privacy.html`) for visual
  brand consistency.

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
- The hostname line reserves vertical space even when hidden (engine
  off), so toggling on/off does not cause layout shift.
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

### Persistence

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
- `SET_COMPRESSOR` { enabled: boolean }
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
- Voice Enhancer with independently toggleable compressor
- Settings persistence across Chrome restart via chrome.storage.sync
- Live FFT spectrum visualizer
- Capture-tab-sticky behavior with hostname display
- Engine On/Off pill with three-state badge
- **Fullscreen compatibility** — captured tab can enter/exit fullscreen
  cleanly. (Fixed by referencing the equalizer-plus open-source
  implementation; the previous bug was in how the MediaStream was
  consumed in the offscreen document.)
- No layout shift when toggling engine on/off
- Pointer cursor on knobs/sliders (was previously showing resize cursor)
- Listing published on Chrome Web Store with privacy policy URL,
  permission justifications, screenshots, and category "Entertainment".

## Backlog (v1.0.1 / v1.1)

These are candidates for the next update. Do NOT batch-implement without
prioritization — wait for user feedback to shape what actually ships.

**v1.0.1 — small fixes:**

- Add a secondary category (Tools) alongside Entertainment for broader reach
- Review whether Master Volume arc could use intensity scaling refined
  (currently subtle; was a polish iteration that landed but is not
  perfect)
- Resolve any user-reported issues from the first 1-2 weeks live

**v1.1 — feature additions (deferred from v1.0 scope):**

- **Per-site EQ profiles** — auto-load saved curve based on tab hostname.
  This is the biggest competitor differentiator we postponed.
- **Custom user-saved presets** — let users name and save their own
  curves alongside the built-in modes.
- A clean gain-reduction meter for the LEVELER mode (`DynamicsCompressorNode.reduction`),
  shown only while LEVELER is active.
- Possible secondary "skins"/themes for the popup UI.

**v2.0 — bigger directions (not committed):**

- Multi-band compression (Tier 3) for a more sophisticated Leveler mode
- Custom AudioWorklet DSP for spectral processing / dynamic EQ
- A constellation of related browser audio tools (limiter, normalizer,
  per-tab loudness control) under a shared FreqWave brand

## Reference implementations

When debugging audio engine or MV3 architecture issues, the closest
working open-source reference is:

- **NikoSardas/equalizer-plus** (MIT licensed, ~10K Chrome Web Store users)
  https://github.com/NikoSardas/equalizer-plus
  Same architecture as ours: Service Worker + Offscreen Document +
  tabCapture + Web Audio API. Use as a diff target when our
  implementation deviates from a known-working pattern.

- **berraknil/BrowserEQ-V2** — German federally-funded open-source EQ
  extension (PrototypeFund/BMBF). Accessibility-focused. Strong copyleft
  license. Reference for accessibility framing and filter type design,
  not for code patterns.

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
- Fullscreen test: YouTube fullscreen button while engine is active —
  must enter and exit cleanly

### Publishing a new version

1. Bump `version` in `manifest.json` (e.g., `1.0.0` → `1.0.1`)
2. Run `npm run build`
3. Zip the contents of `dist/` (manifest.json must be at the zip root)
4. Upload to the Chrome Web Store Developer Dashboard
5. Update store listing fields only if changed; re-justify permissions
   only if the permission set changed
6. Submit for review

## What NOT to do

- Don't move the audio engine into the service worker. Service workers
  cannot use Web Audio API. Non-negotiable.
- Don't skip the ready-handshake. Sending stream IDs before the
  offscreen doc is ready creates hard-to-debug timing bugs.
- Don't destroy the offscreen document on STOP_CAPTURE. Lifecycle is
  lazy-create then persistent until extension unload.
- Don't auto-reconnect when the captured tab closes. Stop silently.
- Don't recreate any kebab-case duplicate files. They were deleted
  intentionally during cleanup.
- Don't add error dialogs or toast notifications for the closed-tab
  case. State change should be silent and visual only.
- Don't overload SET_GAIN — use the separate typed messages defined
  in the message protocol.
- Don't add features beyond what's specified in the v1.0.1/v1.1 backlog
  without explicit decision.
- Don't refactor working code unless asked. Half-finished refactors are
  worse than messy working code.
- Don't accept "Chrome platform restriction" as an answer to bugs.
  When in doubt, diff against the equalizer-plus reference repo.
- Don't change the gain mapping or knob ranges. The current values
  (symmetric ±12 dB, 0 dB at 12 o'clock, linear in dB) are locked.
- Don't break unity gain. If both knobs read 0 dB and all bands are 0 dB
  with Voice Enhancer OFF, output level MUST equal bypassed input level.
- Don't break fullscreen. The captured tab must be able to enter and
  exit fullscreen without disruption.
- Don't change the accent color from `#84e80c` without explicit instruction.
- Don't merge `src/assets/` and `docs/media/`. They are separate by
  intent — one is build-time, the other is public website + archive.
- Don't bump `manifest.json` version backwards or sideways. Each release
  to the Chrome Web Store needs a strictly higher version number.

## How to use this file when working with Claude Code

Reference this document at the start of any prompt that touches code:

> Read `CLAUDE.md` at the project root before doing anything. The "Active
> source files" section tells you which files are live. The "What NOT to do"
> section lists banned approaches. The "Current state" section lists what's
> working that must not regress. The "Backlog" section is the only place to
> draw from for v1.0.1/v1.1 work — don't invent features outside it.
> The "Reference implementations" section lists open-source reference
> repos to use as diff targets for architecture/engine questions.

If something in this doc is wrong or outdated, fix it in a separate pass
before changing code.
