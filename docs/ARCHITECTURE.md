# Architecture

FreqWave EQ is a Manifest V3 Chrome extension with three execution contexts:

1. **Popup** — React UI for EQ controls, presets, and the spectrum visualizer.
   It sends control messages and does not process audio directly.
2. **Service worker** — Coordinates tab capture and routes messages between the
   popup and the offscreen document. It does not use the Web Audio API.
3. **Offscreen document** — Owns the `AudioContext`, audio graph, and audio
   processing. It runs outside the popup so processing continues while the
   popup is closed.

## Audio graph

```text
tab capture source
  -> pre-amp
  -> 8-band equalizer
  -> master gain
  -> optional compressor
  -> analyser
  -> audio destination
```

The equalizer bands are fixed at 32 Hz, 64 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz,
4 kHz, and 8 kHz. Peaking bands use a Q factor of 1.41. Band gains, pre-amp,
and master gain use a symmetric range of -12 dB to +12 dB.

At the default state, with both gain controls at 0 dB, all bands flat, and the
voice enhancer off, the processed output must remain at unity gain relative to
the captured input.

## Capture lifecycle

- The offscreen document is created lazily on the first capture request.
- It sends a ready message before receiving the capture stream ID.
- Stopping capture tears down the audio graph but keeps the offscreen document
  alive for the next start.
- Capture remains attached to the tab where it started.
- If the captured stream ends, the engine stops silently and the popup returns
  to the idle state. There is no automatic reconnect.

## Message boundaries

The popup, service worker, and offscreen document communicate through the typed
protocol in `src/messages/types.ts`. Separate messages are used for band gain,
pre-amp gain, master gain, voice mode, bypass, and compressor state.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

For a local extension build, load the generated `dist/` directory through
`chrome://extensions` with Developer mode enabled. YouTube is a useful general
test target; fullscreen playback should also be tested while capture is active.

## Release checklist

1. Bump the version in `manifest.json` using semantic versioning.
2. Run `npm run build`.
3. Zip the contents of `dist/` with `manifest.json` at the archive root.
4. Upload the archive to the Chrome Web Store Developer Dashboard.