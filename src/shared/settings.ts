// Persisted EQ settings — written to chrome.storage.sync on every change.
// Capture state (on/off, captured tab) is NOT stored here; that lives in
// chrome.storage.session in the service worker.

export type PresetName = "OFF" | "DIALOGUE" | "LEVELER" | "CLARITY";
export type StandardPresetName =
    | "FLAT"
    | "POP"
    | "ROCK"
    | "DISCO"
    | "JAZZ"
    | "CLASSICAL"
    | "BASS_BOOST";

export interface StandardPreset {
    name: StandardPresetName;
    label: string;
    bands: readonly number[];
}

export const STANDARD_PRESETS: readonly StandardPreset[] = [
    { name: "FLAT", label: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0] },
    { name: "POP", label: "Pop", bands: [-1, 2, 3, 4, 3, 1, -1, -2] },
    { name: "ROCK", label: "Rock", bands: [4, 3, 1, -1, -2, 1, 3, 4] },
    { name: "DISCO", label: "Disco", bands: [4, 2, 0, -1, 1, 3, 4, 3] },
    { name: "JAZZ", label: "Jazz", bands: [3, 2, -1, -2, -1, 1, 2, 3] },
    { name: "CLASSICAL", label: "Classical", bands: [3, 2, 1, 0, -1, 1, 2, 3] },
    { name: "BASS_BOOST", label: "Bass Boost", bands: [6, 5, 4, 2, 0, 0, 0, 0] }
];

export interface FreqWaveSettings {
    master: number; // dB, −12 to +12
    preamp: number; // dB, −12 to +12
    bands: number[]; // 8 values, dB, −12 to +12
    preset: PresetName | null; // null = custom (no named preset active)
    eqPreset: StandardPresetName | null;
    compressorEnabled: boolean;
}

export const STORAGE_KEY = "freqwave_settings";

export const DEFAULT_SETTINGS: FreqWaveSettings = {
    master: 0,
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0],
    preset: null,
    eqPreset: "FLAT",
    compressorEnabled: false
};

export function normalizeSettings(
    settings: Partial<FreqWaveSettings> | undefined
): FreqWaveSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        bands: settings?.bands ?? DEFAULT_SETTINGS.bands,
        eqPreset: settings?.eqPreset ?? DEFAULT_SETTINGS.eqPreset,
        // Preserve the previous LEVELER behavior for settings saved before
        // the compressor received its own control.
        compressorEnabled: settings?.compressorEnabled ?? settings?.preset === "LEVELER"
    };
}

export async function loadSettings(): Promise<FreqWaveSettings> {
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage) return DEFAULT_SETTINGS;

    const result = await storage.get(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY] as Partial<FreqWaveSettings> | undefined);
}

export function saveSettings(settings: FreqWaveSettings): void {
    globalThis.chrome?.storage?.sync?.set({ [STORAGE_KEY]: settings });
}
