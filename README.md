# FreqWave EQ

![FreqWave EQ preview](public/FreqWave-EQ-shot-01.png)
FreqWave EQ is a Chrome extension that provides an 8-band equalizer and voice-enhancement modes for improving playback audio (videos, podcasts, movies) in the browser. It uses React, TypeScript, Vite, TailwindCSS and the Web Audio API.

**Status:** Published on the Chrome Web Store (v1.0.0, published 2026-06-29)

- **Chrome Web Store:** https://chromewebstore.google.com/detail/freqwave-eq/emikokoknlgeiloipjheoafjjeoicjap
- **Repository / Homepage:** https://github.com/Bob3x/freqwave-eq
- **Privacy policy:** [docs/privacy.html](docs/privacy.html)

Quick highlights:

- Popup UI with 8-band EQ, Master + Pre-amp knobs, and voice enhancer modes (OFF, DIALOGUE, LEVELER, CLARITY)
- Offscreen audio engine using the Web Audio API (service-worker coordinates lifecycle)
- Settings persisted via `chrome.storage.sync`

## Install

- From the Chrome Web Store: follow the store link above and click "Add to Chrome".
- Local/dev install (developer mode):

```powershell
npm install
npm run build
# In Chrome: chrome://extensions → Developer mode → Load unpacked → select the generated `dist/` folder
```

## Development

- `npm run dev` — start Vite development server (popup UI)
- `npm run build` — produce production build (output in `dist/`)
- `npm run lint` — run ESLint

## Project Structure

- `src/popup/` — popup UI entry and components
- `src/components/eq/` — EQ UI components (BandFader, Knob, Spectrum, etc.)
- `src/background/` — MV3 service worker (coordination)
- `src/offscreen/` — offscreen document and audio engine
- `src/messages/` — typed message protocol between contexts
- `src/shared/` — shared helpers and settings wrapper

## Where to look

- Engine logic: `src/offscreen/offscreen.ts`
- Service worker: `src/background/service-worker.ts`
- Popup UI: `src/popup/` and `src/components/eq/FreqWavePopup.tsx`

---

## License

This project is licensed under the MIT License.

## Contributing

Contributions, bug reports and feature requests are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md)
