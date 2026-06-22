// Persisted EQ settings — written to chrome.storage.sync on every change.
// Capture state (on/off, captured tab) is NOT stored here; that lives in
// chrome.storage.session in the service worker.

export type PresetName = "OFF" | "DIALOGUE" | "LEVELER" | "CLARITY";

export interface FreqWaveSettings {
    master: number;         // dB, −12 to +12
    preamp: number;         // dB, −12 to +12
    bands:  number[];       // 8 values, dB, −12 to +12
    preset: PresetName | null;  // null = custom (no named preset active)
}

export const STORAGE_KEY = "freqwave_settings";

export const DEFAULT_SETTINGS: FreqWaveSettings = {
    master: 0,
    preamp: 0,
    bands:  [0, 0, 0, 0, 0, 0, 0, 0],
    preset: null,
};
